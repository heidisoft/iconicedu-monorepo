import { File as ExpoFile } from 'expo-file-system';
import type {
  MessageVM,
  ReactionVM,
  ThreadVM,
} from '@iconicedu/shared-types';
import { supabase } from '@/lib/supabase/client';
import {
  mapRowToMessageVM,
  buildSenderProfile,
  type RawMessageRow,
  type RawSenderProfile,
} from '../map-row-to-vm';

const BASE_MESSAGE_SELECT = `
  id, org_id, channel_id, sender_profile_id, visibility_type, visibility_user_ids, type, created_at, updated_at, thread_parent_id,
  sender:profiles!sender_profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, kind)
`;

const TYPE_TABLE: Record<string, string> = {
  text: 'message_text',
  image: 'message_image',
  file: 'message_file',
  'audio-recording': 'message_audio_recording',
  'link-preview': 'message_link_preview',
  'lesson-assignment': 'message_lesson_assignment',
  'homework-submission': 'message_homework_submission',
  'progress-update': 'message_progress_update',
  'event-reminder': 'message_event_reminder',
  'session-summary': 'message_session_summary',
  'session-complete': 'message_session_complete',
  'session-booking': 'message_session_booking',
  'payment-reminder': 'message_payment_reminder',
  'feedback-request': 'message_feedback_request',
};

type RawThreadRow = {
  id: string;
  org_id: string;
  channel_id: string;
  parent_message_id: string;
  snippet: string | null;
  author_id: string | null;
  author_name: string | null;
  message_count: number | null;
  last_reply_at: string | null;
  created_at: string;
};

type RawThreadParticipantRow = {
  thread_id: string;
  profile: RawSenderProfile | null;
};

type RawThreadReadStateRow = {
  thread_id: string;
  channel_id: string | null;
  last_read_message_id: string | null;
  last_read_at: string | null;
  unread_count: number | null;
};

export function filterVisibleMessageRows<T extends RawMessageRow>(
  rows: T[],
  currentProfileId = '',
): T[] {
  return rows.filter((row) => {
    if (row.visibility_type !== 'specific-users') return true;
    if (!currentProfileId) return false;
    return (row.visibility_user_ids ?? []).includes(currentProfileId);
  });
}

async function loadPayloads(
  rows: Array<{ id: string; type: string }>,
): Promise<Map<string, Record<string, unknown>>> {
  const byType = new Map<string, string[]>();
  for (const row of rows) {
    const bucket = byType.get(row.type) ?? [];
    bucket.push(row.id);
    byType.set(row.type, bucket);
  }

  const payloadMap = new Map<string, Record<string, unknown>>();
  const fetches: Promise<void>[] = [];

  for (const [type, ids] of byType) {
    const table = TYPE_TABLE[type];
    if (!table) continue;
    fetches.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from(table)
        .select('message_id, payload')
        .in('message_id', ids)
        .is('deleted_at', null)
        .then(
          ({
            data,
          }: {
            data: Array<{ message_id: string; payload: Record<string, unknown> }> | null;
          }) => {
            for (const row of data ?? []) {
              payloadMap.set(row.message_id, row.payload);
            }
          },
        ),
    );
  }

  await Promise.all(fetches);
  return payloadMap;
}

async function loadReactions(
  messageIds: string[],
  currentAccountId: string,
): Promise<Map<string, ReactionVM[]>> {
  if (!messageIds.length) return new Map();

  const { data: reactionRows } = await supabase
    .from('message_reactions')
    .select('message_id, emoji, account_id')
    .in('message_id', messageIds)
    .is('deleted_at', null);

  const grouped = new Map<string, Array<{ emoji: string; account_id: string }>>();
  for (const row of (reactionRows ?? []) as Array<{
    message_id: string;
    emoji: string;
    account_id: string;
  }>) {
    const bucket = grouped.get(row.message_id) ?? [];
    bucket.push({ emoji: row.emoji, account_id: row.account_id });
    grouped.set(row.message_id, bucket);
  }

  const result = new Map<string, ReactionVM[]>();
  for (const [messageId, rawReactions] of grouped) {
    const byEmoji = new Map<string, string[]>();
    for (const reaction of rawReactions) {
      const accounts = byEmoji.get(reaction.emoji) ?? [];
      accounts.push(reaction.account_id);
      byEmoji.set(reaction.emoji, accounts);
    }
    result.set(
      messageId,
      Array.from(byEmoji.entries()).map(([emoji, accountIds]) => ({
        emoji,
        count: accountIds.length,
        reactedByMe: currentAccountId ? accountIds.includes(currentAccountId) : false,
        sampleUserIds: accountIds.slice(0, 5),
      })),
    );
  }
  return result;
}

async function loadThreads(
  parentMessageIds: string[],
  currentAccountId?: string,
): Promise<Map<string, ThreadVM>> {
  if (!parentMessageIds.length) return new Map();

  const { data: threadRows, error: threadError } = await supabase
    .from('threads')
    .select(
      'id, org_id, channel_id, parent_message_id, snippet, author_id, author_name, message_count, last_reply_at, created_at',
    )
    .in('parent_message_id', parentMessageIds);

  if (threadError) {
    console.warn('[loadThreads] threads query failed:', threadError.message);
    return new Map();
  }
  if (!threadRows?.length) return new Map();

  const typedThreadRows = threadRows as RawThreadRow[];
  const threadIds = typedThreadRows.map((thread) => thread.id);

  const [{ data: participantRows, error: participantError }, { data: readStateRows }] =
    await Promise.all([
      supabase
        .from('thread_participants')
        .select(
          'thread_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed, kind)',
        )
        .in('thread_id', threadIds)
        .is('deleted_at', null),
      currentAccountId
        ? supabase
            .from('thread_read_state')
            .select(
              'thread_id, channel_id, last_read_message_id, last_read_at, unread_count',
            )
            .eq('account_id', currentAccountId)
            .in('thread_id', threadIds)
            .is('deleted_at', null)
        : Promise.resolve({ data: [] as RawThreadReadStateRow[] }),
    ]);

  if (participantError) {
    console.warn('[loadThreads] participants query failed:', participantError.message);
  }

  const participantsByThread = new Map<string, RawSenderProfile[]>();
  for (const participant of (participantRows ?? []) as unknown as RawThreadParticipantRow[]) {
    if (!participant.profile) continue;
    const list = participantsByThread.get(participant.thread_id) ?? [];
    list.push(participant.profile);
    participantsByThread.set(participant.thread_id, list);
  }

  const readStateByThread = new Map(
    ((readStateRows ?? []) as RawThreadReadStateRow[]).map((row) => [
      row.thread_id,
      {
        threadId: row.thread_id,
        channelId: row.channel_id ?? undefined,
        lastReadMessageId: row.last_read_message_id ?? undefined,
        lastReadAt: row.last_read_at ?? undefined,
        unreadCount: row.unread_count ?? undefined,
      },
    ]),
  );

  const result = new Map<string, ThreadVM>();
  for (const thread of typedThreadRows) {
    const participants = (participantsByThread.get(thread.id) ?? []).map((profile) =>
      buildSenderProfile(profile, thread.org_id),
    );
    result.set(thread.parent_message_id, {
      ids: { id: thread.id, orgId: thread.org_id },
      parent: {
        messageId: thread.parent_message_id,
        snippet: thread.snippet ?? undefined,
        authorId: thread.author_id ?? undefined,
        authorName: thread.author_name ?? undefined,
      },
      stats: {
        messageCount: thread.message_count ?? 0,
        lastReplyAt: thread.last_reply_at ?? thread.created_at,
      },
      participants,
      readState:
        readStateByThread.get(thread.id) ??
        ({
          threadId: thread.id,
          channelId: thread.channel_id,
        } as ThreadVM['readState']),
    });
  }

  return result;
}

export async function fetchChannelMessages(
  channelId: string,
  currentProfileId = '',
  currentAccountId = '',
  limit = 40,
  before?: string,
): Promise<MessageVM[]> {
  let query = supabase
    .from('messages')
    .select(BASE_MESSAGE_SELECT)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .is('thread_parent_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows?.length) return [];

  const typedRows = filterVisibleMessageRows(
    rows as unknown as RawMessageRow[],
    currentProfileId,
  );
  if (!typedRows.length) return [];

  const messageIds = typedRows.map((row) => row.id);
  const [payloadMap, reactionMap, threadsMap] = await Promise.all([
    loadPayloads(typedRows),
    loadReactions(messageIds, currentAccountId),
    loadThreads(messageIds, currentAccountId),
  ]);

  return [...typedRows]
    .reverse()
    .map((row) =>
      mapRowToMessageVM(
        row,
        payloadMap.get(row.id) ?? null,
        reactionMap.get(row.id) ?? [],
        threadsMap.get(row.id),
      ),
    );
}

export async function fetchThreadMessages(
  threadId: string,
  parentMessageId: string,
  currentProfileId = '',
  currentAccountId = '',
): Promise<MessageVM[]> {
  let { data: rows, error } = await supabase
    .from('messages')
    .select(BASE_MESSAGE_SELECT)
    .eq('thread_id', threadId)
    .neq('id', parentMessageId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (!error && (!rows || rows.length === 0)) {
    ({ data: rows, error } = await supabase
      .from('messages')
      .select(BASE_MESSAGE_SELECT)
      .eq('thread_parent_id', parentMessageId)
      .neq('id', parentMessageId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }));
  }

  if (error) throw error;
  if (!rows?.length) return [];

  const typedRows = filterVisibleMessageRows(
    rows as unknown as RawMessageRow[],
    currentProfileId,
  );
  if (!typedRows.length) return [];

  const messageIds = typedRows.map((row) => row.id);
  const [payloadMap, reactionMap] = await Promise.all([
    loadPayloads(typedRows),
    loadReactions(messageIds, currentAccountId),
  ]);

  return typedRows.map((row) =>
    mapRowToMessageVM(row, payloadMap.get(row.id) ?? null, reactionMap.get(row.id) ?? []),
  );
}

export async function toggleReaction(
  messageId: string,
  accountId: string,
  emoji: string,
  orgId: string,
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('org_id', orgId)
    .eq('message_id', messageId)
    .eq('account_id', accountId)
    .eq('emoji', emoji)
    .is('deleted_at', null)
    .maybeSingle();

  if (selectError) throw selectError;

  const { data: countRow, error: countSelectError } = await supabase
    .from('message_reaction_counts')
    .select('id, count')
    .eq('org_id', orgId)
    .eq('message_id', messageId)
    .eq('emoji', emoji)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; count: number }>();

  if (countSelectError) throw countSelectError;

  if (existing) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('org_id', orgId)
      .eq('message_id', messageId)
      .eq('account_id', accountId)
      .eq('emoji', emoji);
    if (error) throw error;

    if (countRow) {
      if (countRow.count <= 1) {
        const { error: deleteCountError } = await supabase
          .from('message_reaction_counts')
          .delete()
          .eq('id', countRow.id);
        if (deleteCountError) throw deleteCountError;
      } else {
        const { error: updateCountError } = await supabase
          .from('message_reaction_counts')
          .update({ count: countRow.count - 1 })
          .eq('id', countRow.id);
        if (updateCountError) throw updateCountError;
      }
    }
  } else {
    const { error } = await supabase
      .from('message_reactions')
      .insert({ org_id: orgId, message_id: messageId, account_id: accountId, emoji });
    if (error) throw error;

    if (countRow) {
      const { error: updateCountError } = await supabase
        .from('message_reaction_counts')
        .update({ count: countRow.count + 1 })
        .eq('id', countRow.id);
      if (updateCountError) throw updateCountError;
    } else {
      const { error: insertCountError } = await supabase
        .from('message_reaction_counts')
        .insert({ org_id: orgId, message_id: messageId, emoji, count: 1 });
      if (insertCountError) throw insertCountError;
    }
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function fetchChannelReadState(channelId: string, accountId: string) {
  if (!channelId || !accountId) return null;

  const { data, error } = await supabase
    .from('channel_read_state')
    .select('channel_id, last_read_message_id, last_read_at, unread_count')
    .eq('channel_id', channelId)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .maybeSingle<{
      channel_id: string;
      last_read_message_id: string | null;
      last_read_at: string | null;
      unread_count: number | null;
    }>();

  if (error) throw error;
  if (!data) return null;

  return {
    channelId: data.channel_id,
    lastReadMessageId: data.last_read_message_id ?? null,
    lastReadAt: data.last_read_at ?? null,
    unreadCount: data.unread_count ?? 0,
  };
}

export async function markChannelReadState(input: {
  orgId: string;
  accountId: string;
  profileId: string;
  channelId: string;
  lastReadMessageId: string;
}): Promise<number> {
  const membershipLookup = await supabase
    .from('channel_members')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .eq('profile_id', input.profileId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (membershipLookup.error) throw membershipLookup.error;
  if (!membershipLookup.data) throw new Error('Channel not found or access denied');

  const messageLookup = await supabase
    .from('messages')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .eq('id', input.lastReadMessageId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (messageLookup.error) throw messageLookup.error;
  if (!messageLookup.data) throw new Error('Invalid lastReadMessageId for channel');

  const { data, error } = await supabase.rpc('recompute_unread_for_account_channel', {
    p_org_id: input.orgId,
    p_channel_id: input.channelId,
    p_account_id: input.accountId,
    p_last_read_message_id: input.lastReadMessageId,
    p_last_read_at: new Date().toISOString(),
    p_actor_profile_id: input.profileId,
  });

  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export async function markChannelsReadByIds(input: {
  orgId: string;
  accountId: string;
  profileId: string;
  channelIds: string[];
}): Promise<void> {
  const uniqueChannelIds = [...new Set(input.channelIds.filter(Boolean))];
  if (!uniqueChannelIds.length) return;

  await Promise.all(
    uniqueChannelIds.map(async (channelId) => {
      const latestMessageLookup = await supabase
        .from('messages')
        .select('id')
        .eq('org_id', input.orgId)
        .eq('channel_id', channelId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (latestMessageLookup.error) throw latestMessageLookup.error;
      const lastReadMessageId = latestMessageLookup.data?.id;
      if (!lastReadMessageId) return;

      await markChannelReadState({
        orgId: input.orgId,
        accountId: input.accountId,
        profileId: input.profileId,
        channelId,
        lastReadMessageId,
      });
    }),
  );
}

export async function markThreadReadState(input: {
  orgId: string;
  accountId: string;
  profileId: string;
  channelId: string;
  threadId: string;
  lastReadMessageId?: string | null;
}): Promise<number> {
  const threadLookup = await supabase
    .from('threads')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('id', input.threadId)
    .eq('channel_id', input.channelId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (threadLookup.error) throw threadLookup.error;
  if (!threadLookup.data) throw new Error('Thread not found or access denied');

  const participantLookup = await supabase
    .from('thread_participants')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('thread_id', input.threadId)
    .eq('profile_id', input.profileId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (participantLookup.error) throw participantLookup.error;
  if (!participantLookup.data) throw new Error('Thread not found or access denied');

  if (input.lastReadMessageId) {
    const messageLookup = await supabase
      .from('messages')
      .select('id')
      .eq('org_id', input.orgId)
      .eq('channel_id', input.channelId)
      .eq('thread_id', input.threadId)
      .eq('id', input.lastReadMessageId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (messageLookup.error) throw messageLookup.error;
    if (!messageLookup.data) throw new Error('Invalid lastReadMessageId for thread');
  }

  const { data, error } = await supabase.rpc('recompute_unread_for_account_thread', {
    p_org_id: input.orgId,
    p_channel_id: input.channelId,
    p_thread_id: input.threadId,
    p_account_id: input.accountId,
    p_last_read_message_id: input.lastReadMessageId ?? null,
    p_last_read_at: new Date().toISOString(),
    p_actor_profile_id: input.profileId,
  });

  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export async function sendTextMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  text: string,
  threadParentId?: string,
  threadId?: string,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token?.trim();
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:3000';
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/g, '')}/messages/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      orgId,
      channelId,
      senderProfileId,
      content: text,
      threadParentId: threadParentId ?? null,
      threadId: threadId ?? null,
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    message?: string;
    id?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.message ?? 'Unable to send message.');
  }

  return body;
}

const CHANNEL_FILES_BUCKET = 'channel-files';

function sanitizeStorageFileName(name: string, fallback = 'file') {
  const trimmed = name.trim() || fallback;
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

function buildStorageFileKey(name: string, fallbackExt?: string): string {
  const hasExt = /\.[^./]+$/.test(name);
  const rawExt = hasExt ? name.split('.').pop()?.toLowerCase() : null;
  const ext = rawExt ?? fallbackExt ?? null;
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const baseName = sanitizeStorageFileName(name.replace(/\.[^/.]+$/, '')).replace(
    /\.+$/g,
    '',
  );
  return ext
    ? `${timestamp}-${randomSuffix}-${baseName}.${ext}`
    : `${timestamp}-${randomSuffix}-${baseName}`;
}

export function buildMessageStoragePath(
  orgId: string,
  channelId: string,
  profileId: string,
  mimeType: string,
  fileName: string,
): string {
  const kind = mimeType.startsWith('image/')
    ? 'images'
    : mimeType.startsWith('audio/')
      ? 'audio'
      : 'files';
  const fileKey = buildStorageFileKey(fileName);
  return `${orgId}/${channelId}/${kind}/${profileId}/${fileKey}`;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

export async function uploadChannelFile(
  localUri: string,
  storagePath: string,
  mimeType: string,
  prereadBase64?: string,
): Promise<void> {
  const data: Uint8Array = prereadBase64
    ? base64ToUint8Array(prereadBase64)
    : await new ExpoFile(localUri).bytes();

  const { error } = await supabase.storage
    .from(CHANNEL_FILES_BUCKET)
    .upload(storagePath, data, { contentType: mimeType, upsert: false });

  if (error) throw error;
}

export type FileAttachmentInput = {
  storagePath: string;
  name: string;
  mimeType: string;
  size?: number;
  durationSeconds?: number;
};

export async function sendFileMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  file: FileAttachmentInput,
  content?: string,
  threadParentId?: string,
  threadId?: string,
) {
  const isImage = file.mimeType.startsWith('image/');
  const isAudio = file.mimeType.startsWith('audio/');
  const type = isImage ? 'image' : isAudio ? 'audio-recording' : 'file';

  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      sender_profile_id: senderProfileId,
      org_id: orgId,
      type,
      thread_parent_id: threadParentId ?? null,
      ...(threadId ? { thread_id: threadId } : {}),
    })
    .select('id')
    .single();

  if (msgError) throw msgError;

  const payload: Record<string, unknown> = {
    url: file.storagePath,
    storagePath: file.storagePath,
    name: file.name,
    ...(file.size !== undefined ? { size: file.size } : {}),
    mimeType: file.mimeType,
    ...(isAudio ? { durationSeconds: file.durationSeconds ?? 0 } : {}),
    ...(content?.trim() ? { text: content.trim() } : {}),
  };

  const table = isImage
    ? 'message_image'
    : isAudio
      ? 'message_audio_recording'
      : 'message_file';
  const { error: payloadError } = await supabase
    .from(table)
    .insert({ message_id: msg.id, org_id: orgId, payload });

  if (payloadError) throw payloadError;
  return msg;
}

export async function sendFilesMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  files: FileAttachmentInput[],
  content?: string,
  threadParentId?: string,
  threadId?: string,
) {
  if (!files.length) throw new Error('No files provided');
  const allImages = files.every((file) => file.mimeType.startsWith('image/'));
  const type = allImages ? 'image' : 'file';

  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      sender_profile_id: senderProfileId,
      org_id: orgId,
      type,
      thread_parent_id: threadParentId ?? null,
      ...(threadId ? { thread_id: threadId } : {}),
    })
    .select('id')
    .single();

  if (msgError) throw msgError;

  const attachmentsPayload = files.map((file) => ({
    url: file.storagePath,
    storagePath: file.storagePath,
    name: file.name,
    ...(file.size !== undefined ? { size: file.size } : {}),
    mimeType: file.mimeType,
  }));

  const payload: Record<string, unknown> = {
    ...attachmentsPayload[0],
    attachments: attachmentsPayload,
    ...(content?.trim() ? { text: content.trim() } : {}),
  };

  const table = allImages ? 'message_image' : 'message_file';
  const { error: payloadError } = await supabase
    .from(table)
    .insert({ message_id: msg.id, org_id: orgId, payload });

  if (payloadError) throw payloadError;
  return msg;
}
