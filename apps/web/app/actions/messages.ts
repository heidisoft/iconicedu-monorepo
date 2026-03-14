'use server';

import type {
  AudienceRuleVM,
  MessageMentionVM,
  MessageSendFileInput,
  MessageSendFilesInput,
  MessageSendTextInput,
  MessageToggleSavedInput,
  MessageToggleReactionInput,
  MessageVM,
} from '@iconicedu/shared-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { mapMessageRowToVM } from '@iconicedu/web/lib/messages/mappers/message.mapper';
import { buildThreadById } from '@iconicedu/web/lib/messages/builders/thread.builder';
import {
  CHANNEL_FILE_BUCKET,
  createSignedChannelFileUrl,
} from '@iconicedu/web/lib/messages/queries/file-url.query';
import { isValidMessageAssetPath } from '@iconicedu/web/lib/storage/storage-paths';
import {
  extractFirstUrl,
  fetchLinkPreviewMetadata,
} from '@iconicedu/web/lib/messages/link-preview';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';
import {
  filterDmRecipientsByLastReadRecency,
  isDmActivitySuppressionDebugEnabled,
} from '@iconicedu/web/lib/activity-feed/dm-activity-suppression';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;
type ParentMessageRow = {
  id: string;
  org_id: string;
  channel_id: string;
  sender_profile_id: string;
  thread_id?: string | null;
  type: string;
};

type ActivityChannelContext = {
  scope:
    | { kind: 'learning_space'; learningSpaceId: string }
    | { kind: 'channel'; channelId: string };
  targetRef?: { kind: 'learning_space'; id: string };
  channelTopic?: string | null;
  learningSpaceId?: string | null;
  learningSpaceTitle?: string | null;
  channelRouteKind: 'space' | 'dm' | 'channel';
};

type HomeworkMessageIntent = {
  kind: 'homework' | 'lesson';
  cleanedContent: string;
  description: string;
  title: string;
  dueAt: string;
  subject: string;
};

function sanitizeMentions(
  content: string,
  mentions: MessageMentionVM[] | undefined,
  allowedProfileIds: Set<string>,
  currentProfileId: string,
): MessageMentionVM[] {
  if (!mentions?.length) {
    return [];
  }

  const seen = new Set<string>();

  return mentions.filter((mention) => {
    if (!mention?.profileId || mention.profileId === currentProfileId) {
      return false;
    }
    if (!allowedProfileIds.has(mention.profileId)) {
      return false;
    }
    if (
      typeof mention.displayName !== 'string' ||
      typeof mention.start !== 'number' ||
      typeof mention.end !== 'number'
    ) {
      return false;
    }
    if (
      mention.start < 0 ||
      mention.end <= mention.start ||
      mention.end > content.length
    ) {
      return false;
    }
    if (content.slice(mention.start, mention.end) !== `@${mention.displayName}`) {
      return false;
    }

    const key = `${mention.profileId}:${mention.start}:${mention.end}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deriveHomeworkMessageIntent(
  content: string,
  activityContext: ActivityChannelContext,
  explicitHomework?: {
    kind?: 'homework' | 'lesson';
    title: string;
    description?: string;
    dueAt: string;
    subject?: string;
  } | null,
): HomeworkMessageIntent | null {
  if (!explicitHomework) {
    return null;
  }

  return {
    kind: explicitHomework.kind === 'lesson' ? 'lesson' : 'homework',
    cleanedContent: content.trim(),
    description:
      explicitHomework.description?.trim() ||
      content.trim() ||
      'Open the class to review the new assignment.',
    title: explicitHomework.title.trim() || 'Homework assignment',
    dueAt: explicitHomework.dueAt,
    subject:
      explicitHomework.subject?.trim() ||
      activityContext.learningSpaceTitle ||
      activityContext.channelTopic ||
      'Homework',
  };
}

async function createMentionNotifications(input: {
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName: string;
  messageId: string;
  content: string;
  mentions: MessageMentionVM[];
  now: string;
}) {
  const recipientIds = Array.from(
    new Set(input.mentions.map((mention) => mention.profileId)),
  );
  if (!recipientIds.length) {
    return;
  }

  const preferencesResponse = await input.serviceSupabase
    .from('notification_preferences')
    .select('profile_id, channels, muted')
    .eq('org_id', input.orgId)
    .eq('pref_key', 'messages.mentions')
    .in('profile_id', recipientIds)
    .is('deleted_at', null)
    .returns<
      Array<{ profile_id: string; channels: string[] | null; muted?: boolean | null }>
    >();

  if (preferencesResponse.error) {
    throw new Error(preferencesResponse.error.message);
  }

  const preferencesByProfileId = new Map(
    (preferencesResponse.data ?? []).map((row) => [row.profile_id, row]),
  );

  const items = recipientIds.flatMap((recipientId) => {
    const preference = preferencesByProfileId.get(recipientId);
    if (!preference || preference.muted || !preference.channels?.length) {
      return [];
    }

    return [
      {
        org_id: input.orgId,
        kind: 'leaf',
        occurred_at: input.now,
        tab_key: 'all',
        audience: {
          scope: { kind: 'user', userId: recipientId },
          visibility: 'direct',
          audience: [{ kind: 'users_only', userIds: [recipientId] }],
        },
        verb: 'message.posted',
        actor_profile_id: input.senderProfileId,
        refs: {
          object: { kind: 'message', id: input.messageId },
        },
        content: {
          headline: {
            primary: `${input.senderName} mentioned you`,
          },
          summary: input.content,
          preview: { text: input.content.slice(0, 160) },
        },
        summary: `${input.senderName} mentioned you`,
        importance: 'normal',
        is_read: false,
        metadata: {
          notificationKey: 'messages.mentions',
          notificationChannels: preference.channels,
          channelId: input.channelId,
          messageId: input.messageId,
          mentionedProfileId: recipientId,
        },
        created_at: input.now,
        created_by: input.senderProfileId,
        updated_at: input.now,
        updated_by: input.senderProfileId,
      },
    ];
  });

  if (!items.length) {
    return;
  }

  for (const item of items) {
    await publishActivityEvent({
      supabase: input.serviceSupabase,
      orgId: input.orgId,
      eventType: 'message.posted',
      occurredAt: input.now,
      sourceKind: 'profile',
      actorProfileId: input.senderProfileId,
      scope: (item.audience as { scope: { kind: 'user'; userId: string } }).scope,
      objectRef: { kind: 'message', id: input.messageId },
      audienceRules: (item.audience as { audience?: AudienceRuleVM[] }).audience,
      payload: {
        channelId: input.channelId,
        messageId: input.messageId,
        mentionedProfileId: (item.metadata as { mentionedProfileId: string })
          .mentionedProfileId,
        senderName: input.senderName,
        content: input.content,
        threadReply: false,
      },
      dedupeKey: `message.mention:${input.messageId}:${(item.metadata as { mentionedProfileId: string }).mentionedProfileId}`,
      createdBy: input.senderProfileId,
    });
  }
}

async function createChannelMessageActivity(input: {
  supabase: SupabaseServerClient;
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName: string;
  messageId: string;
  content: string;
  threadId?: string | null;
  threadReply?: boolean;
  activityContext: ActivityChannelContext;
  now: string;
}) {
  const isDmRoute = input.activityContext.channelRouteKind === 'dm';
  const eventType = isDmRoute ? 'dm.posted' : 'message.posted';
  const dedupePrefix = isDmRoute ? 'dm.posted' : 'message.posted';
  const dmRecipients = isDmRoute
    ? await resolveDmActivityRecipientProfileIds({
        supabase: input.supabase,
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
        now: input.now,
        eventType: 'dm.posted',
      })
    : null;

  if (isDmRoute && (!dmRecipients || dmRecipients.length === 0)) {
    return;
  }

  await publishActivityEvent({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    eventType,
    occurredAt: input.now,
    sourceKind: 'profile',
    actorProfileId: input.senderProfileId,
    scope: input.activityContext.scope,
    objectRef: { kind: 'message', id: input.messageId },
    targetRef: input.activityContext.targetRef,
    audienceRules:
      isDmRoute && dmRecipients
        ? [{ kind: 'users_only', userIds: dmRecipients }]
        : undefined,
    payload: {
      channelId: input.channelId,
      messageId: input.messageId,
      senderName: input.senderName,
      content: input.content,
      threadId: input.threadId ?? null,
      threadReply: input.threadReply ?? false,
      learningSpaceId: input.activityContext.learningSpaceId ?? null,
      learningSpaceTitle: input.activityContext.learningSpaceTitle ?? null,
      channelTopic: input.activityContext.channelTopic ?? null,
      channelRouteKind: input.activityContext.channelRouteKind,
    },
    dedupeKey: `${dedupePrefix}:${input.messageId}`,
    createdBy: input.senderProfileId,
  });
}

async function createThreadReplyNotifications(input: {
  supabase: SupabaseServerClient;
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  threadId: string;
  channelId: string;
  senderProfileId: string;
  senderName: string;
  messageId: string;
  content: string;
  activityContext: ActivityChannelContext;
  excludeProfileIds?: string[];
  now: string;
}) {
  const participantsResponse = await input.supabase
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
  );

  for (const recipientId of recipientIds) {
    await publishActivityEvent({
      supabase: input.serviceSupabase,
      orgId: input.orgId,
      eventType: 'message.posted',
      occurredAt: input.now,
      sourceKind: 'profile',
      actorProfileId: input.senderProfileId,
      scope: { kind: 'user', userId: recipientId },
      objectRef: { kind: 'message', id: input.messageId },
      targetRef: input.activityContext.targetRef,
      audienceRules: [{ kind: 'users_only', userIds: [recipientId] }],
      payload: {
        channelId: input.channelId,
        messageId: input.messageId,
        senderName: input.senderName,
        content: input.content,
        threadId: input.threadId,
        threadReply: true,
        learningSpaceId: input.activityContext.learningSpaceId ?? null,
        learningSpaceTitle: input.activityContext.learningSpaceTitle ?? null,
        channelTopic: input.activityContext.channelTopic ?? null,
        channelRouteKind: input.activityContext.channelRouteKind,
      },
      dedupeKey: `message.thread-reply:${input.messageId}:${recipientId}`,
      createdBy: input.senderProfileId,
    });
  }
}

async function createFileUploadActivity(input: {
  supabase: SupabaseServerClient;
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName: string;
  messageId: string;
  name: string;
  content?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  fileCount?: number;
  activityContext: ActivityChannelContext;
  now: string;
}) {
  const isDmRoute = input.activityContext.channelRouteKind === 'dm';
  const eventType = isDmRoute ? 'dm.posted' : 'file.uploaded';
  const dedupePrefix = isDmRoute ? 'dm.posted' : 'file.uploaded';
  const activityContent = input.content?.trim() || input.name;
  const dmMessageKind =
    typeof input.mimeType === 'string' && input.mimeType.startsWith('image/')
      ? 'image'
      : typeof input.mimeType === 'string' && input.mimeType.startsWith('audio/')
        ? 'audio'
        : 'file';
  const dmRecipients = isDmRoute
    ? await resolveDmActivityRecipientProfileIds({
        supabase: input.supabase,
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
        now: input.now,
        eventType: 'dm.posted',
      })
    : null;

  if (isDmRoute && (!dmRecipients || dmRecipients.length === 0)) {
    return;
  }

  await publishActivityEvent({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    eventType,
    occurredAt: input.now,
    sourceKind: 'profile',
    actorProfileId: input.senderProfileId,
    scope: input.activityContext.scope,
    objectRef: { kind: 'message', id: input.messageId },
    targetRef: input.activityContext.targetRef,
    audienceRules:
      isDmRoute && dmRecipients
        ? [{ kind: 'users_only', userIds: dmRecipients }]
        : undefined,
    payload: {
      channelId: input.channelId,
      messageId: input.messageId,
      senderName: input.senderName,
      content: activityContent,
      name: input.name,
      mimeType: input.mimeType ?? null,
      storagePath: input.storagePath ?? null,
      fileCount: input.fileCount ?? 1,
      dmMessageKind,
      learningSpaceId: input.activityContext.learningSpaceId ?? null,
      learningSpaceTitle: input.activityContext.learningSpaceTitle ?? null,
      channelTopic: input.activityContext.channelTopic ?? null,
      channelRouteKind: input.activityContext.channelRouteKind,
    },
    dedupeKey: `${dedupePrefix}:${input.messageId}`,
    createdBy: input.senderProfileId,
  });
}

async function resolveActivityChannelContext(input: {
  supabase: SupabaseServerClient;
  orgId: string;
  channelId: string;
}): Promise<ActivityChannelContext> {
  const defaultContext: ActivityChannelContext = {
    scope: { kind: 'channel', channelId: input.channelId },
    channelRouteKind: 'channel',
  };

  const channelsTable = input.supabase.from('channels') as unknown as {
    select?: (query: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          is: (
            column: string,
            value: null,
          ) => {
            maybeSingle: () => Promise<{
              data: {
                id: string;
                kind: string;
                topic?: string | null;
                primary_entity_kind?: string | null;
                primary_entity_id?: string | null;
              } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };

  if (typeof channelsTable.select !== 'function') {
    return defaultContext;
  }

  const channelResponse = await channelsTable
    .select('id, kind, topic, primary_entity_kind, primary_entity_id')
    .eq('org_id', input.orgId)
    .eq('id', input.channelId)
    .is('deleted_at', null)
    .maybeSingle();

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
    };
  }

  const routeKind =
    channel.kind === 'dm' || channel.kind === 'group_dm' ? 'dm' : 'channel';
  return {
    scope: { kind: 'channel', channelId: input.channelId },
    channelTopic: channel.topic ?? null,
    channelRouteKind: routeKind,
  };
}

async function resolveThreadContext(input: {
  supabase: SupabaseServerClient;
  orgId: string;
  channelId: string;
  currentProfileId: string;
  requestedThreadId?: string | null;
  threadParentId?: string | null;
  now: string;
}): Promise<{
  threadId: string | null;
  threadCreated: boolean;
  parentMessage: ParentMessageRow | null;
}> {
  let threadId = input.requestedThreadId ?? null;
  let parentMessage: ParentMessageRow | null = null;
  let threadCreated = false;

  if (!input.threadParentId) {
    return { threadId, threadCreated, parentMessage };
  }

  const parentResponse = await input.supabase
    .from('messages')
    .select('id, org_id, channel_id, sender_profile_id, thread_id, type')
    .eq('id', input.threadParentId)
    .maybeSingle<ParentMessageRow>();

  parentMessage = parentResponse.data ?? null;

  if (
    !parentMessage ||
    parentMessage.org_id !== input.orgId ||
    parentMessage.channel_id !== input.channelId
  ) {
    throw new Error('Parent message not found');
  }

  if (parentMessage.thread_id) {
    threadId = parentMessage.thread_id;
  } else if (threadId) {
    const threadLookup = await input.supabase
      .from('threads')
      .select('id, parent_message_id, channel_id, org_id')
      .eq('id', threadId)
      .maybeSingle<{
        id: string;
        parent_message_id: string | null;
        channel_id: string;
        org_id: string;
      }>();
    if (
      !threadLookup.data ||
      threadLookup.data.parent_message_id !== parentMessage.id ||
      threadLookup.data.channel_id !== input.channelId ||
      threadLookup.data.org_id !== input.orgId
    ) {
      threadId = null;
    }
  }

  if (!threadId) {
    const parentPayloadResponse = await input.supabase
      .from('message_text')
      .select('payload')
      .eq('message_id', parentMessage.id)
      .maybeSingle<{ payload: Record<string, unknown> | null }>();
    const snippet =
      typeof parentPayloadResponse.data?.payload?.text === 'string'
        ? parentPayloadResponse.data.payload.text
        : parentMessage.type;

    const parentSender = await buildUserProfileById(
      input.supabase,
      parentMessage.sender_profile_id,
    );

    const threadInsert = await input.supabase
      .from('threads')
      .insert({
        org_id: input.orgId,
        channel_id: input.channelId,
        parent_message_id: parentMessage.id,
        snippet: snippet?.slice(0, 140) ?? null,
        author_id: parentMessage.sender_profile_id,
        author_name: parentSender?.profile.displayName ?? null,
        message_count: 1,
        last_reply_at: input.now,
        created_at: input.now,
        created_by: input.currentProfileId,
        updated_at: input.now,
        updated_by: input.currentProfileId,
      })
      .select('id')
      .single();

    if (threadInsert.error || !threadInsert.data) {
      throw new Error(threadInsert.error?.message ?? 'Unable to create thread.');
    }

    threadId = threadInsert.data.id;
    threadCreated = true;

    const updateParent = await input.supabase
      .from('messages')
      .update({
        thread_id: threadId,
        updated_at: input.now,
        updated_by: input.currentProfileId,
      })
      .eq('id', parentMessage.id);

    if (updateParent.error) {
      throw new Error(updateParent.error.message);
    }
  }

  if (threadId) {
    const participantRows = Array.from(
      new Set([parentMessage.sender_profile_id, input.currentProfileId]),
    ).map((participantProfileId) => ({
      org_id: input.orgId,
      thread_id: threadId as string,
      profile_id: participantProfileId,
      created_at: input.now,
      created_by: input.currentProfileId,
      updated_at: input.now,
      updated_by: input.currentProfileId,
    }));

    const participantInsert = await input.supabase
      .from('thread_participants')
      .upsert(participantRows, { onConflict: 'org_id,thread_id,profile_id' });

    if (participantInsert.error) {
      throw new Error(participantInsert.error.message);
    }
  }

  return { threadId, threadCreated, parentMessage };
}

async function bumpThreadReplyCount(input: {
  supabase: SupabaseServerClient;
  threadId: string | null;
  threadCreated: boolean;
  now: string;
  currentProfileId: string;
}) {
  if (!input.threadId || input.threadCreated) {
    return;
  }

  const threadRow = await input.supabase
    .from('threads')
    .select('id, message_count')
    .eq('id', input.threadId)
    .maybeSingle<{ id: string; message_count: number | null }>();

  if (!threadRow.data) {
    return;
  }

  const updateThread = await input.supabase
    .from('threads')
    .update({
      message_count: (threadRow.data.message_count ?? 0) + 1,
      last_reply_at: input.now,
      updated_at: input.now,
      updated_by: input.currentProfileId,
    })
    .eq('id', input.threadId);
  if (updateThread.error) {
    throw new Error(updateThread.error.message);
  }
}

async function recallMessageActivities(input: {
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  messageId: string;
  actorProfileId: string;
  now: string;
}) {
  const eventIdsResponse = await input.serviceSupabase
    .from('activity_events')
    .select('id')
    .eq('org_id', input.orgId)
    .contains('object_ref', { kind: 'message', id: input.messageId })
    .is('deleted_at', null)
    .returns<Array<{ id: string }>>();

  if (eventIdsResponse.error) {
    throw new Error(eventIdsResponse.error.message);
  }

  const eventIds = (eventIdsResponse.data ?? []).map((row) => row.id);
  if (!eventIds.length) {
    return;
  }

  const softDeleteAudit = {
    deleted_at: input.now,
    deleted_by: input.actorProfileId,
    updated_at: input.now,
    updated_by: input.actorProfileId,
  };

  const deleteEventsResponse = await input.serviceSupabase
    .from('activity_events')
    .update(softDeleteAudit)
    .eq('org_id', input.orgId)
    .in('id', eventIds)
    .is('deleted_at', null);

  if (deleteEventsResponse.error) {
    throw new Error(deleteEventsResponse.error.message);
  }

  const itemIdsResponse = await input.serviceSupabase
    .from('activity_feed_items')
    .select('id')
    .eq('org_id', input.orgId)
    .in('source_event_id', eventIds)
    .is('deleted_at', null)
    .returns<Array<{ id: string }>>();

  if (itemIdsResponse.error) {
    throw new Error(itemIdsResponse.error.message);
  }

  const itemIds = (itemIdsResponse.data ?? []).map((row) => row.id);
  if (!itemIds.length) {
    return;
  }

  const deleteItemsResponse = await input.serviceSupabase
    .from('activity_feed_items')
    .update(softDeleteAudit)
    .eq('org_id', input.orgId)
    .in('id', itemIds)
    .is('deleted_at', null);

  if (deleteItemsResponse.error) {
    throw new Error(deleteItemsResponse.error.message);
  }

  const groupMembersResponse = await input.serviceSupabase
    .from('activity_feed_group_members')
    .select('group_id,item_id')
    .eq('org_id', input.orgId)
    .in('item_id', itemIds)
    .is('deleted_at', null)
    .returns<Array<{ group_id: string; item_id: string }>>();

  if (groupMembersResponse.error) {
    throw new Error(groupMembersResponse.error.message);
  }

  const touchedGroupIds = Array.from(
    new Set((groupMembersResponse.data ?? []).map((row) => row.group_id)),
  );
  if (!touchedGroupIds.length) {
    return;
  }

  const deleteGroupMembersResponse = await input.serviceSupabase
    .from('activity_feed_group_members')
    .update(softDeleteAudit)
    .eq('org_id', input.orgId)
    .in('item_id', itemIds)
    .is('deleted_at', null);

  if (deleteGroupMembersResponse.error) {
    throw new Error(deleteGroupMembersResponse.error.message);
  }

  for (const groupId of touchedGroupIds) {
    const remainingMembersResponse = await input.serviceSupabase
      .from('activity_feed_group_members')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();

    if (remainingMembersResponse.error) {
      throw new Error(remainingMembersResponse.error.message);
    }

    const remainingCount = remainingMembersResponse.data?.length ?? 0;
    if (remainingCount === 0) {
      const deleteGroupResponse = await input.serviceSupabase
        .from('activity_feed_items')
        .update(softDeleteAudit)
        .eq('org_id', input.orgId)
        .eq('id', groupId)
        .eq('kind', 'group')
        .is('deleted_at', null);

      if (deleteGroupResponse.error) {
        throw new Error(deleteGroupResponse.error.message);
      }
      continue;
    }

    const updateGroupCountResponse = await input.serviceSupabase
      .from('activity_feed_items')
      .update({
        sub_activity_count: remainingCount,
        updated_at: input.now,
        updated_by: input.actorProfileId,
      })
      .eq('org_id', input.orgId)
      .eq('id', groupId)
      .eq('kind', 'group')
      .is('deleted_at', null);

    if (updateGroupCountResponse.error) {
      throw new Error(updateGroupCountResponse.error.message);
    }
  }
}

async function emitReactionActivity(input: {
  supabase: SupabaseServerClient;
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  messageId: string;
  channelId?: string | null;
  senderProfileId: string;
  messageSenderProfileId: string;
  emoji: string;
  eventType:
    | 'dm.reaction.added'
    | 'dm.reaction.removed'
    | 'reaction.added'
    | 'reaction.removed';
  now: string;
}) {
  if (!input.channelId) {
    return;
  }

  const activityContext = await resolveActivityChannelContext({
    supabase: input.supabase,
    orgId: input.orgId,
    channelId: input.channelId,
  });

  const isDmRoute = activityContext.channelRouteKind === 'dm';
  const recipientIds = isDmRoute
    ? await resolveDmActivityRecipientProfileIds({
        supabase: input.supabase,
        orgId: input.orgId,
        channelId: input.channelId,
        senderProfileId: input.senderProfileId,
        now: input.now,
        eventType:
          input.eventType === 'dm.reaction.removed'
            ? 'dm.reaction.removed'
            : 'dm.reaction.added',
      })
    : input.messageSenderProfileId !== input.senderProfileId
      ? [input.messageSenderProfileId]
      : [];

  if (!recipientIds.length) {
    return;
  }

  const sender = await buildUserProfileById(input.supabase, input.senderProfileId);
  const senderName =
    ('profile' in (sender ?? {}) &&
    sender?.profile &&
    typeof sender.profile === 'object' &&
    'displayName' in sender.profile &&
    typeof sender.profile.displayName === 'string'
      ? sender.profile.displayName
      : undefined) ?? 'Someone';

  await publishActivityEvent({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    eventType: input.eventType,
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

async function resolveDmActivityRecipientProfileIds(input: {
  supabase: SupabaseServerClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  now: string;
  eventType: 'dm.posted' | 'dm.reaction.added' | 'dm.reaction.removed';
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
    if (isDmActivitySuppressionDebugEnabled()) {
      console.log('[activity-feed:dm-suppression]', 'decision', {
        eventType: input.eventType,
        channelId: input.channelId,
        candidateRecipients: candidateProfileIds,
        suppressedRecipients: [],
        emittedRecipients: candidateProfileIds,
        reason: 'missing_account_mapping',
      });
    }
    return candidateProfileIds;
  }

  const readStatesResponse = await input.supabase
    .from('channel_read_state')
    .select('account_id,last_read_at')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .in('account_id', accountIds)
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

  if (isDmActivitySuppressionDebugEnabled()) {
    console.log('[activity-feed:dm-suppression]', 'decision', {
      eventType: input.eventType,
      channelId: input.channelId,
      candidateRecipients: candidateProfileIds,
      suppressedRecipients: decision.suppressedProfileIds,
      emittedRecipients: decision.emittedProfileIds,
      reason: 'recent_read_state',
      cutoffAt: decision.cutoffIso,
    });
  }

  return decision.emittedProfileIds;
}

export async function sendTextMessageAction(
  input: MessageSendTextInput,
): Promise<MessageVM> {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }
  const accountOrgId = accountResponse.data.org_id;
  const currentProfileId = profileResponse.data.id;
  const serviceSupabase = createSupabaseServiceClient();

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }
  if (input.senderProfileId !== profileResponse.data.id) {
    throw new Error('Invalid sender');
  }

  let sanitizedMentions: MessageMentionVM[] = [];
  if (input.mentions?.length) {
    const channelMembersResponse = await supabase
      .from('channel_members')
      .select('profile_id')
      .eq('org_id', accountResponse.data.org_id)
      .eq('channel_id', input.channelId)
      .is('deleted_at', null)
      .returns<Array<{ profile_id: string }>>();

    if (channelMembersResponse.error) {
      throw new Error(channelMembersResponse.error.message);
    }

    sanitizedMentions = sanitizeMentions(
      input.content,
      input.mentions,
      new Set((channelMembersResponse.data ?? []).map((member) => member.profile_id)),
      currentProfileId,
    );
  }

  const now = new Date().toISOString();
  const activityContext = await resolveActivityChannelContext({
    supabase,
    orgId: accountOrgId,
    channelId: input.channelId,
  });
  const homeworkIntent = deriveHomeworkMessageIntent(
    input.content,
    activityContext,
    input.homework ?? null,
  );
  const firstUrl = homeworkIntent ? null : extractFirstUrl(input.content);
  const previewMetadata = firstUrl ? await fetchLinkPreviewMetadata(firstUrl) : null;
  const { threadId, threadCreated } = await resolveThreadContext({
    supabase,
    orgId: accountOrgId,
    channelId: input.channelId,
    currentProfileId,
    requestedThreadId: input.threadId,
    threadParentId: input.threadParentId,
    now,
  });

  const messageInsert = await supabase
    .from('messages')
    .insert({
      org_id: accountResponse.data.org_id,
      channel_id: input.channelId,
      sender_profile_id: profileResponse.data.id,
      type: homeworkIntent
        ? 'lesson-assignment'
        : previewMetadata
          ? 'link-preview'
          : 'text',
      visibility_type: 'all',
      thread_id: threadId,
      thread_parent_id: input.threadParentId ?? null,
      created_at: now,
      created_by: profileResponse.data.id,
      updated_at: now,
      updated_by: profileResponse.data.id,
    })
    .select('*')
    .single();

  if (messageInsert.error || !messageInsert.data) {
    throw new Error(messageInsert.error?.message ?? 'Unable to create message.');
  }

  const payloadInsert = await supabase
    .from(
      homeworkIntent
        ? 'message_lesson_assignment'
        : previewMetadata
          ? 'message_link_preview'
          : 'message_text',
    )
    .insert({
      message_id: messageInsert.data.id,
      org_id: accountResponse.data.org_id,
      payload: homeworkIntent
        ? {
            kind: homeworkIntent.kind,
            text: homeworkIntent.cleanedContent,
            title: homeworkIntent.title,
            description: homeworkIntent.description,
            dueAt: homeworkIntent.dueAt,
            subject: homeworkIntent.subject,
          }
        : previewMetadata
          ? {
              ...(input.content.trim() ? { text: input.content } : {}),
              ...(sanitizedMentions.length ? { mentions: sanitizedMentions } : {}),
              url: previewMetadata.url,
              title: previewMetadata.title,
              description: previewMetadata.description,
              imageUrl: previewMetadata.imageUrl,
              siteName: previewMetadata.siteName,
              favicon: previewMetadata.favicon,
            }
          : {
              text: input.content,
              ...(sanitizedMentions.length ? { mentions: sanitizedMentions } : {}),
            },
      created_at: now,
      created_by: profileResponse.data.id,
      updated_at: now,
      updated_by: profileResponse.data.id,
    });

  if (payloadInsert.error) {
    await supabase.from('messages').delete().eq('id', messageInsert.data.id);
    throw new Error(payloadInsert.error.message);
  }

  await bumpThreadReplyCount({
    supabase,
    threadId,
    threadCreated,
    now,
    currentProfileId,
  });

  const sender = await buildUserProfileById(supabase, profileResponse.data.id);
  if (!sender) {
    throw new Error('Sender not found');
  }

  if (sanitizedMentions.length) {
    await createMentionNotifications({
      serviceSupabase,
      orgId: accountResponse.data.org_id,
      channelId: input.channelId,
      senderProfileId: currentProfileId,
      senderName: sender.profile.displayName ?? 'Someone',
      messageId: messageInsert.data.id,
      content: homeworkIntent?.cleanedContent ?? input.content,
      mentions: sanitizedMentions,
      now,
    });
  }

  const senderDisplayName =
    ('profile' in sender &&
    sender.profile &&
    typeof sender.profile === 'object' &&
    'displayName' in sender.profile &&
    typeof sender.profile.displayName === 'string'
      ? sender.profile.displayName
      : undefined) ?? 'Someone';

  if (homeworkIntent && activityContext.scope.kind === 'learning_space') {
    await publishActivityEvent({
      supabase: serviceSupabase,
      orgId: accountResponse.data.org_id,
      eventType: 'homework.assigned',
      occurredAt: now,
      sourceKind: 'profile',
      actorProfileId: currentProfileId,
      scope: activityContext.scope,
      objectRef: { kind: 'message', id: messageInsert.data.id },
      targetRef: activityContext.targetRef,
      payload: {
        channelId: input.channelId,
        messageId: messageInsert.data.id,
        title: homeworkIntent.title,
        description: homeworkIntent.description,
        dueAt: homeworkIntent.dueAt,
        subject: homeworkIntent.subject,
        learningSpaceId: activityContext.learningSpaceId ?? null,
        learningSpaceTitle: activityContext.learningSpaceTitle ?? null,
        channelTopic: activityContext.channelTopic ?? null,
        channelRouteKind: activityContext.channelRouteKind,
      },
      dedupeKey: `homework.assigned:${messageInsert.data.id}`,
      createdBy: currentProfileId,
    });
  } else if (activityContext.channelRouteKind === 'dm') {
    await createChannelMessageActivity({
      supabase,
      serviceSupabase,
      orgId: accountResponse.data.org_id,
      channelId: input.channelId,
      senderProfileId: currentProfileId,
      senderName: senderDisplayName,
      messageId: messageInsert.data.id,
      content: homeworkIntent?.cleanedContent ?? input.content,
      threadId,
      threadReply: Boolean(threadId && input.threadParentId),
      activityContext,
      now,
    });
  } else if (threadId && input.threadParentId) {
    await createThreadReplyNotifications({
      supabase,
      serviceSupabase,
      orgId: accountResponse.data.org_id,
      threadId,
      channelId: input.channelId,
      senderProfileId: currentProfileId,
      senderName: senderDisplayName,
      messageId: messageInsert.data.id,
      content: input.content,
      activityContext,
      excludeProfileIds: sanitizedMentions.map((mention) => mention.profileId),
      now,
    });
  } else {
    await createChannelMessageActivity({
      supabase,
      serviceSupabase,
      orgId: accountResponse.data.org_id,
      channelId: input.channelId,
      senderProfileId: currentProfileId,
      senderName: senderDisplayName,
      messageId: messageInsert.data.id,
      content: homeworkIntent?.cleanedContent ?? input.content,
      threadId,
      threadReply: false,
      activityContext,
      now,
    });
  }

  const thread = threadId
    ? await buildThreadById(supabase, accountResponse.data.org_id, threadId)
    : null;

  return mapMessageRowToVM(messageInsert.data, {
    sender,
    payload: homeworkIntent
      ? {
          kind: homeworkIntent.kind,
          text: homeworkIntent.cleanedContent,
          title: homeworkIntent.title,
          description: homeworkIntent.description,
          dueAt: homeworkIntent.dueAt,
          subject: homeworkIntent.subject,
        }
      : previewMetadata
        ? {
            ...(input.content.trim() ? { text: input.content } : {}),
            ...(sanitizedMentions.length ? { mentions: sanitizedMentions } : {}),
            url: previewMetadata.url,
            title: previewMetadata.title,
            description: previewMetadata.description,
            imageUrl: previewMetadata.imageUrl,
            siteName: previewMetadata.siteName,
            favicon: previewMetadata.favicon,
          }
        : {
            text: input.content,
            ...(sanitizedMentions.length ? { mentions: sanitizedMentions } : {}),
          },
    reactions: [],
    thread: thread ?? undefined,
  });
}

export async function sendFileMessageAction(
  input: MessageSendFileInput,
): Promise<MessageVM> {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }
  if (input.senderProfileId !== profileResponse.data.id) {
    throw new Error('Invalid sender');
  }
  if (!input.name?.trim()) {
    throw new Error('File name is required');
  }
  if (!input.storagePath?.trim()) {
    throw new Error('File storage path is required');
  }
  if (
    !isValidMessageAssetPath({
      storagePath: input.storagePath,
      orgId: input.orgId,
      channelId: input.channelId,
      profileId: profileResponse.data.id,
    })
  ) {
    throw new Error('Invalid file storage path');
  }

  const now = new Date().toISOString();
  const currentProfileId = profileResponse.data.id;
  const serviceSupabase = createSupabaseServiceClient();
  const activityContext = await resolveActivityChannelContext({
    supabase,
    orgId: input.orgId,
    channelId: input.channelId,
  });
  const { threadId, threadCreated } = await resolveThreadContext({
    supabase,
    orgId: accountResponse.data.org_id,
    channelId: input.channelId,
    currentProfileId,
    requestedThreadId: input.threadId,
    threadParentId: input.threadParentId,
    now,
  });
  const signedUrl = await createSignedChannelFileUrl(supabase, input.storagePath);
  const isImageUpload = input.mimeType?.startsWith('image/') ?? false;
  const isAudioUpload = input.mimeType?.startsWith('audio/') ?? false;
  const messageType = isImageUpload
    ? 'image'
    : isAudioUpload
      ? 'audio-recording'
      : 'file';

  const messageInsert = await supabase
    .from('messages')
    .insert({
      org_id: input.orgId,
      channel_id: input.channelId,
      sender_profile_id: currentProfileId,
      type: messageType,
      visibility_type: 'all',
      thread_id: threadId,
      thread_parent_id: input.threadParentId ?? null,
      created_at: now,
      created_by: currentProfileId,
      updated_at: now,
      updated_by: currentProfileId,
    })
    .select('*')
    .single();

  if (messageInsert.error || !messageInsert.data) {
    throw new Error(messageInsert.error?.message ?? 'Unable to create message.');
  }

  const payload = {
    url: input.storagePath,
    storagePath: input.storagePath,
    ...(isAudioUpload
      ? {
          durationSeconds: input.durationSeconds ?? 0,
          fileSize: input.size,
          mimeType: input.mimeType,
        }
      : {
          name: input.name,
          size: input.size,
          mimeType: input.mimeType,
          ...(isImageUpload && input.thumbnailUrl
            ? { thumbnailUrl: input.thumbnailUrl }
            : {}),
        }),
    ...(input.content?.trim() ? { text: input.content.trim() } : {}),
  };

  const payloadInsert = await supabase
    .from(
      isImageUpload
        ? 'message_image'
        : isAudioUpload
          ? 'message_audio_recording'
          : 'message_file',
    )
    .insert({
      message_id: messageInsert.data.id,
      org_id: input.orgId,
      payload,
      created_at: now,
      created_by: currentProfileId,
      updated_at: now,
      updated_by: currentProfileId,
    });

  if (payloadInsert.error) {
    await serviceSupabase.storage.from(CHANNEL_FILE_BUCKET).remove([input.storagePath]);
    await supabase.from('messages').delete().eq('id', messageInsert.data.id);
    throw new Error(payloadInsert.error.message);
  }

  const channelAssetInsert = isImageUpload
    ? await supabase.from('channel_media').insert({
        org_id: input.orgId,
        channel_id: input.channelId,
        message_id: messageInsert.data.id,
        sender_profile_id: currentProfileId,
        type: 'image',
        url: input.storagePath,
        name: input.name,
        width: null,
        height: null,
        created_at: now,
        created_by: currentProfileId,
        updated_at: now,
        updated_by: currentProfileId,
      })
    : await supabase.from('channel_files').insert({
        org_id: input.orgId,
        channel_id: input.channelId,
        message_id: messageInsert.data.id,
        sender_profile_id: currentProfileId,
        kind: 'file',
        url: input.storagePath,
        name: input.name,
        mime_type: input.mimeType ?? null,
        size: input.size ?? null,
        created_at: now,
        created_by: currentProfileId,
        updated_at: now,
        updated_by: currentProfileId,
      });

  if (channelAssetInsert.error) {
    await serviceSupabase.storage.from(CHANNEL_FILE_BUCKET).remove([input.storagePath]);
    await supabase
      .from(
        isImageUpload
          ? 'message_image'
          : isAudioUpload
            ? 'message_audio_recording'
            : 'message_file',
      )
      .delete()
      .eq('message_id', messageInsert.data.id);
    await supabase.from('messages').delete().eq('id', messageInsert.data.id);
    throw new Error(channelAssetInsert.error.message);
  }

  await bumpThreadReplyCount({
    supabase,
    threadId,
    threadCreated,
    now,
    currentProfileId,
  });

  const sender = await buildUserProfileById(supabase, currentProfileId);
  if (!sender) {
    throw new Error('Sender not found');
  }
  const senderDisplayName =
    ('profile' in sender &&
    sender.profile &&
    typeof sender.profile === 'object' &&
    'displayName' in sender.profile &&
    typeof sender.profile.displayName === 'string'
      ? sender.profile.displayName
      : undefined) ?? 'Someone';

  const thread = threadId
    ? await buildThreadById(supabase, accountResponse.data.org_id, threadId)
    : null;

  await createFileUploadActivity({
    supabase,
    serviceSupabase,
    orgId: input.orgId,
    channelId: input.channelId,
    senderProfileId: currentProfileId,
    senderName: senderDisplayName,
    messageId: messageInsert.data.id,
    name: input.name,
    content: input.content?.trim() ?? null,
    mimeType: input.mimeType ?? null,
    storagePath: input.storagePath,
    activityContext,
    now,
  });

  return mapMessageRowToVM(messageInsert.data, {
    sender,
    payload: {
      ...payload,
      url: signedUrl,
    },
    reactions: [],
    thread: thread ?? undefined,
  });
}

export async function sendFilesMessageAction(
  input: MessageSendFilesInput,
): Promise<MessageVM> {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }
  if (input.senderProfileId !== profileResponse.data.id) {
    throw new Error('Invalid sender');
  }
  if (!input.assets.length) {
    throw new Error('At least one file is required');
  }

  const currentProfileId = profileResponse.data.id;
  for (const asset of input.assets) {
    if (!asset.name?.trim()) {
      throw new Error('File name is required');
    }
    if (!asset.storagePath?.trim()) {
      throw new Error('File storage path is required');
    }
    if (
      !isValidMessageAssetPath({
        storagePath: asset.storagePath,
        orgId: input.orgId,
        channelId: input.channelId,
        profileId: currentProfileId,
      })
    ) {
      throw new Error('Invalid file storage path');
    }
  }

  const allImages = input.assets.every((asset) => asset.mimeType?.startsWith('image/'));
  const anyImages = input.assets.some((asset) => asset.mimeType?.startsWith('image/'));
  const anyAudio = input.assets.some((asset) => asset.mimeType?.startsWith('audio/'));

  if (anyAudio) {
    throw new Error('Audio recordings must be sent individually');
  }
  if (anyImages && !allImages) {
    throw new Error('Mixed file and image uploads must be sent separately');
  }

  const now = new Date().toISOString();
  const serviceSupabase = createSupabaseServiceClient();
  const activityContext = await resolveActivityChannelContext({
    supabase,
    orgId: input.orgId,
    channelId: input.channelId,
  });
  const { threadId, threadCreated } = await resolveThreadContext({
    supabase,
    orgId: accountResponse.data.org_id,
    channelId: input.channelId,
    currentProfileId,
    requestedThreadId: input.threadId,
    threadParentId: input.threadParentId,
    now,
  });

  const messageType = allImages ? 'image' : 'file';
  const messageInsert = await supabase
    .from('messages')
    .insert({
      org_id: input.orgId,
      channel_id: input.channelId,
      sender_profile_id: currentProfileId,
      type: messageType,
      visibility_type: 'all',
      thread_id: threadId,
      thread_parent_id: input.threadParentId ?? null,
      created_at: now,
      created_by: currentProfileId,
      updated_at: now,
      updated_by: currentProfileId,
    })
    .select('*')
    .single();

  if (messageInsert.error || !messageInsert.data) {
    throw new Error(messageInsert.error?.message ?? 'Unable to create message.');
  }

  const signedAssets = await Promise.all(
    input.assets.map(async (asset) => ({
      ...asset,
      url: await createSignedChannelFileUrl(supabase, asset.storagePath),
    })),
  );

  const attachmentsPayload = input.assets.map((asset) => ({
    url: asset.storagePath,
    storagePath: asset.storagePath,
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType,
    ...(allImages && asset.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}),
  }));

  const payloadInsert = await supabase
    .from(allImages ? 'message_image' : 'message_file')
    .insert({
      message_id: messageInsert.data.id,
      org_id: input.orgId,
      payload: {
        ...attachmentsPayload[0],
        attachments: attachmentsPayload,
        ...(input.content?.trim() ? { text: input.content.trim() } : {}),
      },
      created_at: now,
      created_by: currentProfileId,
      updated_at: now,
      updated_by: currentProfileId,
    });

  if (payloadInsert.error) {
    await serviceSupabase.storage
      .from(CHANNEL_FILE_BUCKET)
      .remove(input.assets.map((asset) => asset.storagePath));
    await supabase.from('messages').delete().eq('id', messageInsert.data.id);
    throw new Error(payloadInsert.error.message);
  }

  const channelAssetInsert = allImages
    ? await supabase.from('channel_media').insert(
        input.assets.map((asset) => ({
          org_id: input.orgId,
          channel_id: input.channelId,
          message_id: messageInsert.data.id,
          sender_profile_id: currentProfileId,
          type: 'image',
          url: asset.storagePath,
          name: asset.name,
          width: null,
          height: null,
          created_at: now,
          created_by: currentProfileId,
          updated_at: now,
          updated_by: currentProfileId,
        })),
      )
    : await supabase.from('channel_files').insert(
        input.assets.map((asset) => ({
          org_id: input.orgId,
          channel_id: input.channelId,
          message_id: messageInsert.data.id,
          sender_profile_id: currentProfileId,
          kind: 'file',
          url: asset.storagePath,
          name: asset.name,
          mime_type: asset.mimeType ?? null,
          size: asset.size ?? null,
          created_at: now,
          created_by: currentProfileId,
          updated_at: now,
          updated_by: currentProfileId,
        })),
      );

  if (channelAssetInsert.error) {
    await serviceSupabase.storage
      .from(CHANNEL_FILE_BUCKET)
      .remove(input.assets.map((asset) => asset.storagePath));
    await supabase
      .from(allImages ? 'message_image' : 'message_file')
      .delete()
      .eq('message_id', messageInsert.data.id);
    await supabase.from('messages').delete().eq('id', messageInsert.data.id);
    throw new Error(channelAssetInsert.error.message);
  }

  await bumpThreadReplyCount({
    supabase,
    threadId,
    threadCreated,
    now,
    currentProfileId,
  });

  const sender = await buildUserProfileById(supabase, currentProfileId);
  if (!sender) {
    throw new Error('Sender not found');
  }
  const senderDisplayName =
    ('profile' in sender &&
    sender.profile &&
    typeof sender.profile === 'object' &&
    'displayName' in sender.profile &&
    typeof sender.profile.displayName === 'string'
      ? sender.profile.displayName
      : undefined) ?? 'Someone';

  const thread = threadId
    ? await buildThreadById(supabase, accountResponse.data.org_id, threadId)
    : null;

  await createFileUploadActivity({
    supabase,
    serviceSupabase,
    orgId: input.orgId,
    channelId: input.channelId,
    senderProfileId: currentProfileId,
    senderName: senderDisplayName,
    messageId: messageInsert.data.id,
    name:
      input.assets.length > 1
        ? `${input.assets[0]?.name ?? 'File'} +${input.assets.length - 1} more`
        : (input.assets[0]?.name ?? 'File'),
    content: input.content?.trim() ?? null,
    mimeType: allImages ? 'image/*' : (input.assets[0]?.mimeType ?? null),
    storagePath: input.assets[0]?.storagePath ?? null,
    fileCount: input.assets.length,
    activityContext,
    now,
  });

  return mapMessageRowToVM(messageInsert.data, {
    sender,
    payload: {
      ...attachmentsPayload[0],
      attachments: signedAssets.map((asset) => ({
        url: asset.url,
        storagePath: asset.storagePath,
        name: asset.name,
        size: asset.size,
        mimeType: asset.mimeType,
        ...(allImages && asset.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}),
      })),
      ...(input.content?.trim() ? { text: input.content.trim() } : {}),
    },
    reactions: [],
    thread: thread ?? undefined,
  });
}

export async function toggleMessageReactionAction(
  input: MessageToggleReactionInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  if (!input.emoji?.trim()) {
    throw new Error('Emoji is required');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }

  const messageResponse = await supabase
    .from('messages')
    .select('id, org_id, channel_id, sender_profile_id')
    .eq('id', input.messageId)
    .maybeSingle<{
      id: string;
      org_id: string;
      channel_id?: string | null;
      sender_profile_id?: string | null;
    }>();

  if (!messageResponse.data || messageResponse.data.org_id !== input.orgId) {
    throw new Error('Message not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  const reactionResponse = await supabase
    .from('message_reactions')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('message_id', input.messageId)
    .eq('account_id', accountResponse.data.id)
    .eq('emoji', input.emoji)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  const countResponse = await supabase
    .from('message_reaction_counts')
    .select('id, count')
    .eq('org_id', input.orgId)
    .eq('message_id', input.messageId)
    .eq('emoji', input.emoji)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; count: number }>();

  if (reactionResponse.data?.id) {
    const deleteReaction = await supabase
      .from('message_reactions')
      .delete()
      .eq('id', reactionResponse.data.id);

    if (deleteReaction.error) {
      throw new Error(deleteReaction.error.message);
    }

    if (countResponse.data) {
      if (countResponse.data.count <= 1) {
        const deleteCount = await supabase
          .from('message_reaction_counts')
          .delete()
          .eq('id', countResponse.data.id);
        if (deleteCount.error) {
          throw new Error(deleteCount.error.message);
        }
      } else {
        const updateCount = await supabase
          .from('message_reaction_counts')
          .update({ count: countResponse.data.count - 1 })
          .eq('id', countResponse.data.id);
        if (updateCount.error) {
          throw new Error(updateCount.error.message);
        }
      }
    }

    const isDmRoute =
      (
        await resolveActivityChannelContext({
          supabase,
          orgId: input.orgId,
          channelId: messageResponse.data.channel_id ?? '',
        })
      ).channelRouteKind === 'dm';

    await emitReactionActivity({
      supabase,
      serviceSupabase,
      orgId: input.orgId,
      messageId: input.messageId,
      channelId: messageResponse.data.channel_id ?? null,
      senderProfileId: profileResponse.data.id,
      messageSenderProfileId: messageResponse.data.sender_profile_id ?? '',
      emoji: input.emoji,
      eventType: isDmRoute ? 'dm.reaction.removed' : 'reaction.removed',
      now: new Date().toISOString(),
    });

    return;
  }

  const now = new Date().toISOString();
  const insertReaction = await supabase.from('message_reactions').insert({
    org_id: input.orgId,
    message_id: input.messageId,
    account_id: accountResponse.data.id,
    emoji: input.emoji,
    created_at: now,
    updated_at: now,
  });

  if (insertReaction.error) {
    throw new Error(insertReaction.error.message);
  }

  if (countResponse.data) {
    const updateCount = await supabase
      .from('message_reaction_counts')
      .update({ count: countResponse.data.count + 1 })
      .eq('id', countResponse.data.id);
    if (updateCount.error) {
      throw new Error(updateCount.error.message);
    }

    const isDmRoute =
      (
        await resolveActivityChannelContext({
          supabase,
          orgId: input.orgId,
          channelId: messageResponse.data.channel_id ?? '',
        })
      ).channelRouteKind === 'dm';

    await emitReactionActivity({
      supabase,
      serviceSupabase,
      orgId: input.orgId,
      messageId: input.messageId,
      channelId: messageResponse.data.channel_id ?? null,
      senderProfileId: profileResponse.data.id,
      messageSenderProfileId: messageResponse.data.sender_profile_id ?? '',
      emoji: input.emoji,
      eventType: isDmRoute ? 'dm.reaction.added' : 'reaction.added',
      now,
    });
    return;
  }

  const insertCount = await supabase.from('message_reaction_counts').insert({
    org_id: input.orgId,
    message_id: input.messageId,
    emoji: input.emoji,
    count: 1,
    created_at: now,
    updated_at: now,
  });

  if (insertCount.error) {
    throw new Error(insertCount.error.message);
  }

  const isDmRoute =
    (
      await resolveActivityChannelContext({
        supabase,
        orgId: input.orgId,
        channelId: messageResponse.data.channel_id ?? '',
      })
    ).channelRouteKind === 'dm';

  await emitReactionActivity({
    supabase,
    serviceSupabase,
    orgId: input.orgId,
    messageId: input.messageId,
    channelId: messageResponse.data.channel_id ?? null,
    senderProfileId: profileResponse.data.id,
    messageSenderProfileId: messageResponse.data.sender_profile_id ?? '',
    emoji: input.emoji,
    eventType: isDmRoute ? 'dm.reaction.added' : 'reaction.added',
    now,
  });
}

export async function deleteMessageAction(input: {
  messageId: string;
  orgId: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }

  const messageResponse = await supabase
    .from('messages')
    .select('id, org_id, sender_profile_id')
    .eq('id', input.messageId)
    .maybeSingle<{ id: string; org_id: string; sender_profile_id: string }>();

  if (!messageResponse.data || messageResponse.data.org_id !== input.orgId) {
    throw new Error('Message not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  if (messageResponse.data.sender_profile_id !== profileResponse.data.id) {
    throw new Error('Unauthorized: You can only delete your own messages');
  }

  const now = new Date().toISOString();

  const deleteResult = await serviceSupabase
    .from('messages')
    .update({
      deleted_at: now,
      deleted_by: profileResponse.data.id,
    })
    .eq('id', input.messageId)
    .eq('org_id', input.orgId)
    .eq('sender_profile_id', profileResponse.data.id)
    .is('deleted_at', null);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  await recallMessageActivities({
    serviceSupabase,
    orgId: input.orgId,
    messageId: input.messageId,
    actorProfileId: profileResponse.data.id,
    now,
  });
}

export async function toggleHiddenMessageAction(input: {
  messageId: string;
  orgId: string;
  isHidden: boolean;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }

  const messageResponse = await supabase
    .from('messages')
    .select('id, org_id, sender_profile_id')
    .eq('id', input.messageId)
    .maybeSingle<{ id: string; org_id: string; sender_profile_id: string }>();

  if (!messageResponse.data || messageResponse.data.org_id !== input.orgId) {
    throw new Error('Message not found');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  if (messageResponse.data.sender_profile_id !== profileResponse.data.id) {
    throw new Error('Unauthorized: You can only hide your own messages');
  }

  const updateResult = await supabase
    .from('messages')
    .update({
      is_hidden: input.isHidden,
    })
    .eq('id', input.messageId)
    .eq('org_id', input.orgId)
    .eq('sender_profile_id', profileResponse.data.id)
    .is('deleted_at', null);

  if (updateResult.error) {
    throw new Error(updateResult.error.message);
  }
}

export async function toggleSavedMessageAction(
  input: MessageToggleSavedInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserId(supabase, authUser.id);

  if (!accountResponse.data) {
    throw new Error('Account not found');
  }

  if (input.orgId !== accountResponse.data.org_id) {
    throw new Error('Invalid org');
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  const messageResponse = await supabase
    .from('messages')
    .select('id, org_id, channel_id')
    .eq('id', input.messageId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; org_id: string; channel_id: string }>();

  if (!messageResponse.data || messageResponse.data.org_id !== input.orgId) {
    throw new Error('Message not found');
  }

  const membershipResponse = await supabase
    .from('channel_members')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('channel_id', messageResponse.data.channel_id)
    .eq('profile_id', profileResponse.data.id)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (!membershipResponse.data) {
    throw new Error('Unauthorized');
  }

  const now = new Date().toISOString();

  if (input.isSaved) {
    const upsertResponse = await supabase.from('message_saves').upsert(
      {
        org_id: input.orgId,
        message_id: input.messageId,
        channel_id: messageResponse.data.channel_id,
        profile_id: profileResponse.data.id,
        created_at: now,
        created_by: profileResponse.data.id,
        updated_at: now,
        updated_by: profileResponse.data.id,
        deleted_at: null,
        deleted_by: null,
      },
      {
        onConflict: 'org_id,message_id,profile_id',
      },
    );

    if (upsertResponse.error) {
      throw new Error(upsertResponse.error.message);
    }

    return;
  }

  const unsaveResponse = await supabase
    .from('message_saves')
    .update({
      deleted_at: now,
      deleted_by: profileResponse.data.id,
      updated_at: now,
      updated_by: profileResponse.data.id,
    })
    .eq('org_id', input.orgId)
    .eq('message_id', input.messageId)
    .eq('profile_id', profileResponse.data.id)
    .is('deleted_at', null);

  if (unsaveResponse.error) {
    throw new Error(unsaveResponse.error.message);
  }
}
