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
import { CHANNEL_FILE_BUCKET, createSignedChannelFileUrl } from '@iconicedu/web/lib/messages/queries/file-url.query';
import { isValidMessageAssetPath } from '@iconicedu/web/lib/storage/storage-paths';
import { extractFirstUrl, fetchLinkPreviewMetadata } from '@iconicedu/web/lib/messages/link-preview';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';

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
    if (mention.start < 0 || mention.end <= mention.start || mention.end > content.length) {
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
  const recipientIds = Array.from(new Set(input.mentions.map((mention) => mention.profileId)));
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
    .returns<Array<{ profile_id: string; channels: string[] | null; muted?: boolean | null }>>();

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
        mentionedProfileId: (item.metadata as { mentionedProfileId: string }).mentionedProfileId,
        senderName: input.senderName,
        content: input.content,
      },
      dedupeKey: `message.mention:${input.messageId}:${(item.metadata as { mentionedProfileId: string }).mentionedProfileId}`,
      createdBy: input.senderProfileId,
    });
  }
}

async function createChannelMessageActivity(input: {
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  senderName: string;
  messageId: string;
  content: string;
  now: string;
}) {
  await publishActivityEvent({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    eventType: 'message.posted',
    occurredAt: input.now,
    sourceKind: 'profile',
    actorProfileId: input.senderProfileId,
    scope: { kind: 'channel', channelId: input.channelId },
    objectRef: { kind: 'message', id: input.messageId },
    payload: {
      channelId: input.channelId,
      messageId: input.messageId,
      senderName: input.senderName,
      content: input.content,
    },
    dedupeKey: `message.posted:${input.messageId}`,
    createdBy: input.senderProfileId,
  });
}

async function createFileUploadActivity(input: {
  serviceSupabase: SupabaseServiceClient;
  orgId: string;
  channelId: string;
  senderProfileId: string;
  messageId: string;
  name: string;
  content?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  fileCount?: number;
  now: string;
}) {
  await publishActivityEvent({
    supabase: input.serviceSupabase,
    orgId: input.orgId,
    eventType: 'file.uploaded',
    occurredAt: input.now,
    sourceKind: 'profile',
    actorProfileId: input.senderProfileId,
    scope: { kind: 'channel', channelId: input.channelId },
    objectRef: { kind: 'message', id: input.messageId },
    payload: {
      channelId: input.channelId,
      messageId: input.messageId,
      name: input.name,
      content: input.content ?? null,
      mimeType: input.mimeType ?? null,
      storagePath: input.storagePath ?? null,
      fileCount: input.fileCount ?? 1,
    },
    dedupeKey: `file.uploaded:${input.messageId}`,
    createdBy: input.senderProfileId,
  });
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
  const firstUrl = extractFirstUrl(input.content);
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
      type: previewMetadata ? 'link-preview' : 'text',
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
    .from(previewMetadata ? 'message_link_preview' : 'message_text')
    .insert({
      message_id: messageInsert.data.id,
      org_id: accountResponse.data.org_id,
      payload: previewMetadata
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
      content: input.content,
      mentions: sanitizedMentions,
      now,
    });
  }

  await createChannelMessageActivity({
    serviceSupabase,
    orgId: accountResponse.data.org_id,
    channelId: input.channelId,
    senderProfileId: currentProfileId,
    senderName:
      ('profile' in sender &&
      sender.profile &&
      typeof sender.profile === 'object' &&
      'displayName' in sender.profile &&
      typeof sender.profile.displayName === 'string'
        ? sender.profile.displayName
        : undefined) ?? 'Someone',
    messageId: messageInsert.data.id,
    content: input.content,
    now,
  });

  const thread = threadId
    ? await buildThreadById(supabase, accountResponse.data.org_id, threadId)
    : null;

  return mapMessageRowToVM(messageInsert.data, {
    sender,
    payload: previewMetadata
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
  const messageType = isImageUpload ? 'image' : isAudioUpload ? 'audio-recording' : 'file';

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
          ...(isImageUpload && input.thumbnailUrl ? { thumbnailUrl: input.thumbnailUrl } : {}),
        }),
    ...(input.content?.trim() ? { text: input.content.trim() } : {}),
  };

  const payloadInsert = await supabase
    .from(isImageUpload ? 'message_image' : isAudioUpload ? 'message_audio_recording' : 'message_file')
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
      .from(isImageUpload ? 'message_image' : isAudioUpload ? 'message_audio_recording' : 'message_file')
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

  const thread = threadId
    ? await buildThreadById(supabase, accountResponse.data.org_id, threadId)
    : null;

  await createFileUploadActivity({
    serviceSupabase,
    orgId: input.orgId,
    channelId: input.channelId,
    senderProfileId: currentProfileId,
    messageId: messageInsert.data.id,
    name: input.name,
    content: input.content?.trim() ?? null,
    mimeType: input.mimeType ?? null,
    storagePath: input.storagePath,
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
    await serviceSupabase.storage.from(CHANNEL_FILE_BUCKET).remove(input.assets.map((asset) => asset.storagePath));
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
    await serviceSupabase.storage.from(CHANNEL_FILE_BUCKET).remove(input.assets.map((asset) => asset.storagePath));
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

  const thread = threadId
    ? await buildThreadById(supabase, accountResponse.data.org_id, threadId)
    : null;

  await createFileUploadActivity({
    serviceSupabase,
    orgId: input.orgId,
    channelId: input.channelId,
    senderProfileId: currentProfileId,
    messageId: messageInsert.data.id,
    name:
      input.assets.length > 1
        ? `${input.assets[0]?.name ?? 'File'} +${input.assets.length - 1} more`
        : input.assets[0]?.name ?? 'File',
    content: input.content?.trim() ?? null,
    mimeType: allImages ? 'image/*' : input.assets[0]?.mimeType ?? null,
    storagePath: input.assets[0]?.storagePath ?? null,
    fileCount: input.assets.length,
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
    .select('id, org_id')
    .eq('id', input.messageId)
    .maybeSingle<{ id: string; org_id: string }>();

  if (!messageResponse.data || messageResponse.data.org_id !== input.orgId) {
    throw new Error('Message not found');
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
    const upsertResponse = await supabase
      .from('message_saves')
      .upsert({
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
      }, {
        onConflict: 'org_id,message_id,profile_id',
      });

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
