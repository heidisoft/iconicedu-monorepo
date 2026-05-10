import type { AudienceRuleVM, MessageMentionVM } from '@iconicedu/shared-types';

import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

type SupabaseQueryClient = Pick<SupabaseServiceClient, 'from'>;
type PublishActivityFn = typeof publishActivityEvent;

export type ActivityChannelContext = {
  scope:
    | { kind: 'learning_space'; learningSpaceId: string }
    | { kind: 'channel'; channelId: string }
    | { kind: 'user'; userId: string };
  targetRef?: { kind: 'learning_space'; id: string };
  channelTopic?: string | null;
  learningSpaceId?: string | null;
  learningSpaceTitle?: string | null;
  channelRouteKind: 'space' | 'dm' | 'channel';
  channelPurpose?: string | null;
  channelVisibility?: string | null;
};

export type VisibilityAudienceResolution = {
  suppressActivity: boolean;
  audienceRules?: AudienceRuleVM[];
  allowedProfileIds?: Set<string> | null;
};

export function resolveVisibilityAudienceFromMessageRow(input: {
  visibilityType?: string | null;
  visibilityUserId?: string | null;
  visibilityUserIds?: string[] | null;
}): VisibilityAudienceResolution {
  const visibilityType = input.visibilityType ?? 'all';
  if (visibilityType === 'sender-only') {
    return {
      suppressActivity: true,
      allowedProfileIds: new Set(),
    };
  }

  if (visibilityType === 'recipient-only') {
    const userIds = input.visibilityUserId ? [input.visibilityUserId] : [];
    return {
      suppressActivity: userIds.length === 0,
      audienceRules: userIds.length ? [{ kind: 'users_only', userIds }] : undefined,
      allowedProfileIds: new Set(userIds),
    };
  }

  if (visibilityType === 'specific-users') {
    const userIds = Array.from(new Set(input.visibilityUserIds ?? []));
    return {
      suppressActivity: userIds.length === 0,
      audienceRules: userIds.length ? [{ kind: 'users_only', userIds }] : undefined,
      allowedProfileIds: new Set(userIds),
    };
  }

  return {
    suppressActivity: false,
    allowedProfileIds: null,
  };
}

function filterDmRecipientsByLastReadRecency(input: {
  candidateProfileIds: string[];
  profileLastReadAtById: Map<string, string | null | undefined>;
  now: string;
}) {
  const nowTime = new Date(input.now).getTime();
  const oneMinuteMs = 60 * 1000;

  const emittedProfileIds = input.candidateProfileIds.filter((profileId) => {
    const lastReadAt = input.profileLastReadAtById.get(profileId);
    if (!lastReadAt) {
      return true;
    }

    const lastReadTime = new Date(lastReadAt).getTime();
    if (Number.isNaN(lastReadTime)) {
      return true;
    }

    return nowTime - lastReadTime > oneMinuteMs;
  });

  return { emittedProfileIds };
}

function buildDisplayName(input: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  const displayName = input.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const fullName = [input.first_name?.trim(), input.last_name?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();

  return fullName || 'Someone';
}

async function resolveSenderDisplayName(input: {
  supabase: SupabaseQueryClient;
  orgId: string;
  senderProfileId: string;
}) {
  const response = await input.supabase
    .from('profiles')
    .select('display_name, first_name, last_name')
    .eq('org_id', input.orgId)
    .eq('id', input.senderProfileId)
    .is('deleted_at', null)
    .maybeSingle<{
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }>();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return buildDisplayName(response.data ?? {});
}

export async function resolveActivityChannelContext(input: {
  supabase: SupabaseQueryClient;
  orgId: string;
  channelId: string;
}): Promise<ActivityChannelContext> {
  const defaultContext: ActivityChannelContext = {
    scope: { kind: 'channel', channelId: input.channelId },
    channelRouteKind: 'channel',
  };

  const channelResponse = await input.supabase
    .from('channels')
    .select(
      'id, kind, topic, purpose, visibility, primary_entity_kind, primary_entity_id',
    )
    .eq('org_id', input.orgId)
    .eq('id', input.channelId)
    .is('deleted_at', null)
    .maybeSingle<{
      id: string;
      kind: string;
      topic?: string | null;
      purpose?: string | null;
      visibility?: string | null;
      primary_entity_kind?: string | null;
      primary_entity_id?: string | null;
    }>();

  if (channelResponse.error) {
    throw new Error(channelResponse.error.message);
  }

  const channel = channelResponse.data;
  if (!channel) {
    return defaultContext;
  }

  if (channel.primary_entity_kind === 'learning_space' && channel.primary_entity_id) {
    return {
      scope: { kind: 'learning_space', learningSpaceId: channel.primary_entity_id },
      targetRef: { kind: 'learning_space', id: channel.primary_entity_id },
      channelTopic: channel.topic ?? null,
      learningSpaceId: channel.primary_entity_id,
      learningSpaceTitle: channel.topic ?? null,
      channelRouteKind: 'space',
      channelPurpose: channel.purpose ?? null,
      channelVisibility: channel.visibility ?? null,
    };
  }

  const routeKind =
    channel.kind === 'dm' || channel.kind === 'group_dm' ? 'dm' : 'channel';

  return {
    scope: { kind: 'channel', channelId: input.channelId },
    channelTopic: channel.topic ?? null,
    channelRouteKind: routeKind,
    channelPurpose: channel.purpose ?? null,
    channelVisibility: channel.visibility ?? null,
  };
}

async function resolveDmActivityRecipientProfileIds(input: {
  supabase: SupabaseQueryClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  now: string;
}) {
  const membersResponse = await input.supabase
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();

  if (membersResponse.error) {
    throw new Error(membersResponse.error.message);
  }

  const candidateProfileIds = Array.from(
    new Set(
      (membersResponse.data ?? [])
        .map((row) => row.profile_id)
        .filter((id) => id && id !== input.senderProfileId),
    ),
  );

  if (!candidateProfileIds.length) {
    return [];
  }

  const profilesResponse = await input.supabase
    .from('profiles')
    .select('id, account_id')
    .eq('org_id', input.orgId)
    .in('id', candidateProfileIds)
    .is('deleted_at', null)
    .returns<Array<{ id: string; account_id: string | null }>>();

  if (profilesResponse.error) {
    throw new Error(profilesResponse.error.message);
  }

  const accountIdByProfileId = new Map(
    (profilesResponse.data ?? [])
      .filter((row) => row.id && row.account_id)
      .map((row) => [row.id, row.account_id as string]),
  );

  const accountIds = Array.from(new Set(Array.from(accountIdByProfileId.values())));
  if (!accountIds.length) {
    return candidateProfileIds;
  }

  const readStatesResponse = await input.supabase
    .from('channel_read_state')
    .select('account_id,last_read_at')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .in('account_id', accountIds)
    .is('thread_id', null)
    .is('deleted_at', null)
    .returns<Array<{ account_id: string; last_read_at: string | null }>>();

  if (readStatesResponse.error) {
    throw new Error(readStatesResponse.error.message);
  }

  const lastReadAtByAccountId = new Map(
    (readStatesResponse.data ?? []).map((row) => [row.account_id, row.last_read_at]),
  );
  const profileLastReadAtById = new Map<string, string | null | undefined>();
  for (const profileId of candidateProfileIds) {
    const accountId = accountIdByProfileId.get(profileId);
    profileLastReadAtById.set(
      profileId,
      accountId ? lastReadAtByAccountId.get(accountId) : undefined,
    );
  }

  const decision = filterDmRecipientsByLastReadRecency({
    candidateProfileIds,
    profileLastReadAtById,
    now: input.now,
  });

  return decision.emittedProfileIds;
}

async function resolveMentionRecipientIds(input: {
  supabase: SupabaseQueryClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  mentions: MessageMentionVM[];
  visibilityAllowedProfileIds?: Set<string> | null;
}) {
  const mentionedProfileIds = Array.from(
    new Set(
      input.mentions
        .map((mention) => mention?.profileId)
        .filter((profileId): profileId is string => Boolean(profileId)),
    ),
  ).filter((profileId) => profileId !== input.senderProfileId);

  if (!mentionedProfileIds.length) {
    return [];
  }

  const membersResponse = await input.supabase
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();

  if (membersResponse.error) {
    throw new Error(membersResponse.error.message);
  }

  const memberIds = new Set((membersResponse.data ?? []).map((row) => row.profile_id));

  return mentionedProfileIds.filter((profileId) => {
    if (!memberIds.has(profileId)) {
      return false;
    }

    return input.visibilityAllowedProfileIds
      ? input.visibilityAllowedProfileIds.has(profileId)
      : true;
  });
}

export async function publishMentionActivities(input: {
  supabase: SupabaseServiceClient;
  readSupabase?: SupabaseQueryClient;
  publishActivity?: PublishActivityFn;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName?: string;
  messageId: string;
  content: string;
  mentions: MessageMentionVM[];
  now: string;
  visibilityAllowedProfileIds?: Set<string> | null;
}) {
  const readSupabase = input.readSupabase ?? input.supabase;
  const recipientIds = await resolveMentionRecipientIds({
    supabase: readSupabase,
    orgId: input.orgId,
    channelId: input.channelId,
    senderProfileId: input.senderProfileId,
    mentions: input.mentions,
    visibilityAllowedProfileIds: input.visibilityAllowedProfileIds,
  });

  if (!recipientIds.length) {
    return;
  }

  const senderName =
    input.senderName ??
    (await resolveSenderDisplayName({
      supabase: readSupabase,
      orgId: input.orgId,
      senderProfileId: input.senderProfileId,
    }));

  const publishActivity = input.publishActivity ?? publishActivityEvent;

  for (const recipientId of recipientIds) {
    await publishActivity({
      supabase: input.supabase,
      orgId: input.orgId,
      eventType: 'message.mentioned',
      occurredAt: input.now,
      sourceKind: 'profile',
      actorProfileId: input.senderProfileId,
      scope: { kind: 'user', userId: recipientId },
      objectRef: { kind: 'message', id: input.messageId },
      audienceRules: [{ kind: 'users_only', userIds: [recipientId] }],
      payload: {
        channelId: input.channelId,
        messageId: input.messageId,
        mentionedProfileId: recipientId,
        senderName,
        content: input.content,
        threadReply: false,
      },
      dedupeKey: `message.mention:${input.messageId}:${recipientId}`,
      createdBy: input.senderProfileId,
    });
  }
}

export async function publishChannelMessageActivity(input: {
  supabase: SupabaseServiceClient;
  readSupabase?: SupabaseQueryClient;
  publishActivity?: PublishActivityFn;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName?: string;
  messageId: string;
  content: string;
  threadId?: string | null;
  threadReply?: boolean;
  activityContext?: ActivityChannelContext;
  now: string;
  visibilityAudienceRules?: AudienceRuleVM[];
  visibilityAllowedProfileIds?: Set<string> | null;
}) {
  const readSupabase = input.readSupabase ?? input.supabase;
  const activityContext =
    input.activityContext ??
    (await resolveActivityChannelContext({
      supabase: readSupabase,
      orgId: input.orgId,
      channelId: input.channelId,
    }));
  const senderName =
    input.senderName ??
    (await resolveSenderDisplayName({
      supabase: readSupabase,
      orgId: input.orgId,
      senderProfileId: input.senderProfileId,
    }));
  const isDmRoute = activityContext.channelRouteKind === 'dm';
  const eventType = 'message.posted';
  const dedupePrefix = 'message.posted';
  const dmRecipients = isDmRoute
    ? await resolveDmActivityRecipientProfileIds({
        supabase: readSupabase,
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
        now: input.now,
      })
    : null;
  const scopedDmRecipients = isDmRoute
    ? (dmRecipients ?? []).filter((profileId) =>
        input.visibilityAllowedProfileIds
          ? input.visibilityAllowedProfileIds.has(profileId)
          : true,
      )
    : null;
  const publishActivity = input.publishActivity ?? publishActivityEvent;

  if (isDmRoute && (!scopedDmRecipients || scopedDmRecipients.length === 0)) {
    return;
  }

  await publishActivity({
    supabase: input.supabase,
    orgId: input.orgId,
    eventType,
    occurredAt: input.now,
    sourceKind: 'profile',
    actorProfileId: input.senderProfileId,
    scope: activityContext.scope,
    objectRef: { kind: 'message', id: input.messageId },
    targetRef: activityContext.targetRef,
    audienceRules:
      isDmRoute && scopedDmRecipients
        ? [{ kind: 'users_only', userIds: scopedDmRecipients }]
        : input.visibilityAudienceRules,
    payload: {
      channelId: input.channelId,
      messageId: input.messageId,
      senderName,
      content: input.content,
      threadId: input.threadId ?? null,
      threadReply: input.threadReply ?? false,
      learningSpaceId: activityContext.learningSpaceId ?? null,
      learningSpaceTitle: activityContext.learningSpaceTitle ?? null,
      channelTopic: activityContext.channelTopic ?? null,
      channelRouteKind: activityContext.channelRouteKind,
    },
    dedupeKey: `${eventType}:${input.messageId}`,
    createdBy: input.senderProfileId,
  });
}

export async function publishReactionAddedActivity(input: {
  supabase: SupabaseServiceClient;
  readSupabase?: SupabaseQueryClient;
  publishActivity?: PublishActivityFn;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName?: string;
  messageId: string;
  messageSenderProfileId: string;
  emoji: string;
  now: string;
}) {
  const readSupabase = input.readSupabase ?? input.supabase;
  const activityContext = await resolveActivityChannelContext({
    supabase: readSupabase,
    orgId: input.orgId,
    channelId: input.channelId,
  });
  const senderName =
    input.senderName ??
    (await resolveSenderDisplayName({
      supabase: readSupabase,
      orgId: input.orgId,
      senderProfileId: input.senderProfileId,
    }));
  const isDmRoute = activityContext.channelRouteKind === 'dm';
  const recipientIds = isDmRoute
    ? await resolveDmActivityRecipientProfileIds({
        supabase: readSupabase,
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
        now: input.now,
      })
    : input.messageSenderProfileId !== input.senderProfileId
      ? [input.messageSenderProfileId]
      : [];
  const publishActivity = input.publishActivity ?? publishActivityEvent;

  if (!recipientIds.length) {
    return;
  }

  await publishActivity({
    supabase: input.supabase,
    orgId: input.orgId,
    eventType: 'reaction.added',
    occurredAt: input.now,
    sourceKind: 'profile',
    actorProfileId: input.senderProfileId,
    scope: isDmRoute
      ? activityContext.scope
      : { kind: 'user', userId: input.messageSenderProfileId },
    objectRef: { kind: 'message', id: input.messageId },
    targetRef: activityContext.targetRef,
    audienceRules: [{ kind: 'users_only', userIds: recipientIds }],
    payload: {
      channelId: input.channelId,
      messageId: input.messageId,
      senderName,
      emoji: input.emoji,
      channelTopic: activityContext.channelTopic ?? null,
      channelRouteKind: activityContext.channelRouteKind,
      learningSpaceId: activityContext.learningSpaceId ?? null,
      learningSpaceTitle: activityContext.learningSpaceTitle ?? null,
    },
    createdBy: input.senderProfileId,
  });
}

export async function publishThreadReplyActivities(input: {
  supabase: SupabaseServiceClient;
  readSupabase?: SupabaseQueryClient;
  publishActivity?: PublishActivityFn;
  orgId: string;
  threadId: string;
  channelId: string;
  senderProfileId: string;
  senderName?: string;
  messageId: string;
  content: string;
  activityContext?: ActivityChannelContext;
  now: string;
  excludeProfileIds?: string[];
  visibilityAllowedProfileIds?: Set<string> | null;
}) {
  const readSupabase = input.readSupabase ?? input.supabase;
  const activityContext =
    input.activityContext ??
    (await resolveActivityChannelContext({
      supabase: readSupabase,
      orgId: input.orgId,
      channelId: input.channelId,
    }));
  const senderName =
    input.senderName ??
    (await resolveSenderDisplayName({
      supabase: readSupabase,
      orgId: input.orgId,
      senderProfileId: input.senderProfileId,
    }));
  const participantsResponse = await readSupabase
    .from('thread_participants')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('thread_id', input.threadId)
    .is('deleted_at', null)
    .returns<Array<{ profile_id: string }>>();

  if (participantsResponse.error) {
    throw new Error(participantsResponse.error.message);
  }

  const exclude = new Set([input.senderProfileId, ...(input.excludeProfileIds ?? [])]);
  const recipientIds = Array.from(
    new Set(
      (participantsResponse.data ?? [])
        .map((row) => row.profile_id)
        .filter((profileId) => profileId && !exclude.has(profileId)),
    ),
  ).filter((profileId) =>
    input.visibilityAllowedProfileIds
      ? input.visibilityAllowedProfileIds.has(profileId)
      : true,
  );
  const publishActivity = input.publishActivity ?? publishActivityEvent;

  for (const recipientId of recipientIds) {
    await publishActivity({
      supabase: input.supabase,
      orgId: input.orgId,
      eventType: 'message.thread_reply.posted',
      occurredAt: input.now,
      sourceKind: 'profile',
      actorProfileId: input.senderProfileId,
      scope: { kind: 'user', userId: recipientId },
      objectRef: { kind: 'message', id: input.messageId },
      targetRef: activityContext.targetRef,
      audienceRules: [{ kind: 'users_only', userIds: [recipientId] }],
      payload: {
        channelId: input.channelId,
        messageId: input.messageId,
        senderName,
        content: input.content,
        threadId: input.threadId,
        threadReply: true,
        learningSpaceId: activityContext.learningSpaceId ?? null,
        learningSpaceTitle: activityContext.learningSpaceTitle ?? null,
        channelTopic: activityContext.channelTopic ?? null,
        channelRouteKind: activityContext.channelRouteKind,
      },
      dedupeKey: `message.thread-reply:${input.messageId}:${recipientId}`,
      createdBy: input.senderProfileId,
    });
  }
}

export async function publishFileUploadActivity(input: {
  supabase: SupabaseServiceClient;
  readSupabase?: SupabaseQueryClient;
  publishActivity?: PublishActivityFn;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName?: string;
  messageId: string;
  name: string;
  content?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  fileCount?: number;
  activityContext?: ActivityChannelContext;
  now: string;
  visibilityAudienceRules?: AudienceRuleVM[];
  visibilityAllowedProfileIds?: Set<string> | null;
}) {
  const readSupabase = input.readSupabase ?? input.supabase;
  const activityContext =
    input.activityContext ??
    (await resolveActivityChannelContext({
      supabase: readSupabase,
      orgId: input.orgId,
      channelId: input.channelId,
    }));
  const senderName =
    input.senderName ??
    (await resolveSenderDisplayName({
      supabase: readSupabase,
      orgId: input.orgId,
      senderProfileId: input.senderProfileId,
    }));
  const isDmRoute = activityContext.channelRouteKind === 'dm';
  const activityContent = input.content?.trim() || input.name;
  const dmMessageKind =
    typeof input.mimeType === 'string' && input.mimeType.startsWith('image/')
      ? 'image'
      : typeof input.mimeType === 'string' && input.mimeType.startsWith('audio/')
        ? 'audio'
        : 'file';
  const eventType =
    dmMessageKind === 'image'
      ? 'image.uploaded'
      : dmMessageKind === 'audio'
        ? 'audio.uploaded'
        : 'file.uploaded';
  const dmRecipients = isDmRoute
    ? await resolveDmActivityRecipientProfileIds({
        supabase: readSupabase,
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
        now: input.now,
      })
    : null;
  const scopedDmRecipients = isDmRoute
    ? (dmRecipients ?? []).filter((profileId) =>
        input.visibilityAllowedProfileIds
          ? input.visibilityAllowedProfileIds.has(profileId)
          : true,
      )
    : null;
  const publishActivity = input.publishActivity ?? publishActivityEvent;

  if (isDmRoute && (!scopedDmRecipients || scopedDmRecipients.length === 0)) {
    return;
  }

  await publishActivity({
    supabase: input.supabase,
    orgId: input.orgId,
    eventType,
    occurredAt: input.now,
    sourceKind: 'profile',
    actorProfileId: input.senderProfileId,
    scope: activityContext.scope,
    objectRef: { kind: 'message', id: input.messageId },
    targetRef: activityContext.targetRef,
    audienceRules:
      isDmRoute && scopedDmRecipients
        ? [{ kind: 'users_only', userIds: scopedDmRecipients }]
        : input.visibilityAudienceRules,
    payload: {
      channelId: input.channelId,
      messageId: input.messageId,
      senderName,
      content: activityContent,
      name: input.name,
      mimeType: input.mimeType ?? null,
      storagePath: input.storagePath ?? null,
      fileCount: input.fileCount ?? 1,
      dmMessageKind,
      learningSpaceId: activityContext.learningSpaceId ?? null,
      learningSpaceTitle: activityContext.learningSpaceTitle ?? null,
      channelTopic: activityContext.channelTopic ?? null,
      channelRouteKind: activityContext.channelRouteKind,
    },
    dedupeKey: `${eventType}:${input.messageId}`,
    createdBy: input.senderProfileId,
  });
}

export async function publishTextMessagePostSendActivities(input: {
  supabase: SupabaseServiceClient;
  readSupabase?: SupabaseQueryClient;
  publishActivity?: PublishActivityFn;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName?: string;
  messageId: string;
  content: string;
  mentions?: MessageMentionVM[];
  threadId?: string | null;
  threadReply?: boolean;
  now: string;
  activityContext?: ActivityChannelContext;
  visibilityAudience?: VisibilityAudienceResolution;
}) {
  const readSupabase = input.readSupabase ?? input.supabase;
  const activityContext =
    input.activityContext ??
    (await resolveActivityChannelContext({
      supabase: readSupabase,
      orgId: input.orgId,
      channelId: input.channelId,
    }));
  const senderName =
    input.senderName ??
    (await resolveSenderDisplayName({
      supabase: readSupabase,
      orgId: input.orgId,
      senderProfileId: input.senderProfileId,
    }));
  const visibilityAllowedProfileIds = input.visibilityAudience?.allowedProfileIds ?? null;

  if (input.mentions?.length) {
    await publishMentionActivities({
      supabase: input.supabase,
      readSupabase,
      publishActivity: input.publishActivity,
      orgId: input.orgId,
      channelId: input.channelId,
      senderProfileId: input.senderProfileId,
      senderName,
      messageId: input.messageId,
      content: input.content,
      mentions: input.mentions,
      now: input.now,
      visibilityAllowedProfileIds,
    });
  }

  if (input.visibilityAudience?.suppressActivity) {
    return;
  }

  if (activityContext.channelRouteKind === 'dm') {
    await publishChannelMessageActivity({
      supabase: input.supabase,
      readSupabase,
      publishActivity: input.publishActivity,
      orgId: input.orgId,
      channelId: input.channelId,
      senderProfileId: input.senderProfileId,
      senderName,
      messageId: input.messageId,
      content: input.content,
      threadId: input.threadId ?? null,
      threadReply: Boolean(input.threadId && input.threadReply),
      activityContext,
      now: input.now,
      visibilityAudienceRules: input.visibilityAudience?.audienceRules,
      visibilityAllowedProfileIds,
    });
    return;
  }

  if (input.threadId && input.threadReply) {
    await publishThreadReplyActivities({
      supabase: input.supabase,
      readSupabase,
      publishActivity: input.publishActivity,
      orgId: input.orgId,
      threadId: input.threadId,
      channelId: input.channelId,
      senderProfileId: input.senderProfileId,
      senderName,
      messageId: input.messageId,
      content: input.content,
      activityContext,
      now: input.now,
      excludeProfileIds: input.mentions?.map((mention) => mention.profileId),
      visibilityAllowedProfileIds,
    });
    return;
  }

  await publishChannelMessageActivity({
    supabase: input.supabase,
    readSupabase,
    publishActivity: input.publishActivity,
    orgId: input.orgId,
    channelId: input.channelId,
    senderProfileId: input.senderProfileId,
    senderName,
    messageId: input.messageId,
    content: input.content,
    threadId: input.threadId ?? null,
    threadReply: false,
    activityContext,
    now: input.now,
    visibilityAudienceRules: input.visibilityAudience?.audienceRules,
    visibilityAllowedProfileIds,
  });
}

export async function publishFileMessagePostSendActivity(input: {
  supabase: SupabaseServiceClient;
  readSupabase?: SupabaseQueryClient;
  publishActivity?: PublishActivityFn;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName?: string;
  messageId: string;
  name: string;
  content?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  fileCount?: number;
  now: string;
  activityContext?: ActivityChannelContext;
  visibilityAudience?: VisibilityAudienceResolution;
}) {
  if (input.visibilityAudience?.suppressActivity) {
    return;
  }

  await publishFileUploadActivity({
    supabase: input.supabase,
    readSupabase: input.readSupabase,
    publishActivity: input.publishActivity,
    orgId: input.orgId,
    channelId: input.channelId,
    senderProfileId: input.senderProfileId,
    senderName: input.senderName,
    messageId: input.messageId,
    name: input.name,
    content: input.content,
    mimeType: input.mimeType,
    storagePath: input.storagePath,
    fileCount: input.fileCount,
    activityContext: input.activityContext,
    now: input.now,
    visibilityAudienceRules: input.visibilityAudience?.audienceRules,
    visibilityAllowedProfileIds: input.visibilityAudience?.allowedProfileIds ?? null,
  });
}
