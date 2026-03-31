import { File as ExpoFile } from 'expo-file-system';
import type { MessageVM, ReactionVM, ThreadVM } from '@iconicedu/shared-types';
import { supabase } from '@/lib/supabase/client';
import {
  mapRowToMessageVM,
  buildSenderProfile,
  type RawMessageRow,
  type RawSenderProfile,
} from '@/lib/api/map-row-to-vm';

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

function logMessageMutation(
  event: string,
  detail: Record<string, unknown>,
  level: 'debug' | 'error' = 'debug',
) {
  const logger = level === 'error' ? console.error : console.debug;
  logger(`[messages] ${event}`, detail);
}

function createClientUuid(): string {
  const nativeRandomUuid = globalThis.crypto?.randomUUID;
  if (typeof nativeRandomUuid === 'function') {
    return nativeRandomUuid.call(globalThis.crypto);
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

type MessageWriteDebugContext = {
  authUserId: string | null;
  currentAccountId: string | null;
  currentAccountOrgId: string | null;
  currentAccountActiveProfileId: string | null;
  requestedProfileAccountId: string | null;
  requestedProfileOrgId: string | null;
  requestedProfileKind: string | null;
  resolvedProfileAccountId: string | null;
  resolvedProfileOrgId: string | null;
  resolvedProfileKind: string | null;
  channelKind: string | null;
  channelPurpose: string | null;
  channelMemberProfileIds: string[];
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

type ParentMessageLookupRow = {
  id: string;
  org_id: string;
  channel_id: string;
  sender_profile_id: string;
  thread_id: string | null;
  type: string;
};

type ThreadLookupRow = {
  id: string;
  parent_message_id: string | null;
  channel_id: string;
  org_id: string;
  message_count?: number | null;
};

type CurrentAccountLookupRow = {
  id: string;
  org_id: string | null;
  active_profile_id: string | null;
};

type ProfileOwnershipLookupRow = {
  id: string;
  account_id: string;
  org_id: string;
};

type ChannelKindLookupRow = {
  id: string;
  kind: string;
  purpose?: string | null;
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

async function collectMessageWriteDebugContext(input: {
  orgId: string;
  channelId: string;
  requestedSenderProfileId: string;
  resolvedSenderProfileId: string;
}): Promise<MessageWriteDebugContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authUserId = user?.id ?? null;

  const currentAccountLookup = authUserId
    ? await supabase
        .from('accounts')
        .select('id, org_id, active_profile_id')
        .eq('auth_user_id', authUserId)
        .is('deleted_at', null)
        .maybeSingle<CurrentAccountLookupRow>()
    : { data: null, error: null };

  if (currentAccountLookup.error) throw currentAccountLookup.error;

  const currentAccount = currentAccountLookup.data;
  const profileIds = Array.from(
    new Set(
      [input.requestedSenderProfileId, input.resolvedSenderProfileId].filter(Boolean),
    ),
  );

  const profileLookup = profileIds.length
    ? await supabase
        .from('profiles')
        .select('id, account_id, org_id, kind')
        .in('id', profileIds)
        .is('deleted_at', null)
    : { data: [], error: null };

  if (profileLookup.error) throw profileLookup.error;

  const profilesById = new Map(
    (
      (profileLookup.data ?? []) as Array<{
        id: string;
        account_id: string;
        org_id: string;
        kind: string | null;
      }>
    ).map((profile) => [profile.id, profile]),
  );

  const channelLookup = await supabase
    .from('channels')
    .select('id, kind, purpose')
    .eq('id', input.channelId)
    .eq('org_id', input.orgId)
    .is('deleted_at', null)
    .maybeSingle<ChannelKindLookupRow>();

  if (channelLookup.error) throw channelLookup.error;

  const channelMembersLookup = await supabase
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', input.orgId)
    .eq('channel_id', input.channelId)
    .is('deleted_at', null);

  if (channelMembersLookup.error) throw channelMembersLookup.error;

  const requestedProfile = profilesById.get(input.requestedSenderProfileId);
  const resolvedProfile = profilesById.get(input.resolvedSenderProfileId);

  return {
    authUserId,
    currentAccountId: currentAccount?.id ?? null,
    currentAccountOrgId: currentAccount?.org_id ?? null,
    currentAccountActiveProfileId: currentAccount?.active_profile_id ?? null,
    requestedProfileAccountId: requestedProfile?.account_id ?? null,
    requestedProfileOrgId: requestedProfile?.org_id ?? null,
    requestedProfileKind: requestedProfile?.kind ?? null,
    resolvedProfileAccountId: resolvedProfile?.account_id ?? null,
    resolvedProfileOrgId: resolvedProfile?.org_id ?? null,
    resolvedProfileKind: resolvedProfile?.kind ?? null,
    channelKind: channelLookup.data?.kind ?? null,
    channelPurpose: channelLookup.data?.purpose ?? null,
    channelMemberProfileIds: Array.from(
      new Set(
        (channelMembersLookup.data ?? [])
          .map((member) => (member.profile_id as string | undefined) ?? '')
          .filter(Boolean),
      ),
    ),
  };
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
  for (const participant of (participantRows ??
    []) as unknown as RawThreadParticipantRow[]) {
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

async function loadMessageSnippet(messageId: string, type: string): Promise<string> {
  const table = TYPE_TABLE[type];
  if (!table) return type;

  const { data, error } = await supabase
    .from(table)
    .select('payload')
    .eq('message_id', messageId)
    .maybeSingle<{ payload: Record<string, unknown> | null }>();

  if (error) throw error;

  const text = data?.payload?.text;
  return typeof text === 'string' && text.trim().length > 0 ? text.trim() : type;
}

async function loadProfileDisplayName(profileId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, first_name, last_name')
    .eq('id', profileId)
    .is('deleted_at', null)
    .maybeSingle<{
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }>();

  if (error) throw error;
  if (!data) return null;

  const fallbackName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  if (data.display_name) return data.display_name;
  return fallbackName || null;
}

async function resolveWritableSenderProfileId(
  orgId: string,
  requestedSenderProfileId: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return requestedSenderProfileId;

  const { data: currentAccount, error: accountError } = await supabase
    .from('accounts')
    .select('id, org_id, active_profile_id')
    .eq('auth_user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle<CurrentAccountLookupRow>();

  if (accountError) throw accountError;
  if (!currentAccount?.id) return requestedSenderProfileId;

  const { data: requestedProfile, error: requestedProfileError } = await supabase
    .from('profiles')
    .select('id, account_id, org_id')
    .eq('id', requestedSenderProfileId)
    .is('deleted_at', null)
    .maybeSingle<ProfileOwnershipLookupRow>();

  if (requestedProfileError) throw requestedProfileError;
  if (!requestedProfile) return requestedSenderProfileId;

  const ownsRequestedProfile =
    requestedProfile.org_id === orgId &&
    requestedProfile.account_id === currentAccount.id;
  if (ownsRequestedProfile) return requestedSenderProfileId;

  const { data: familyLink, error: familyLinkError } = await supabase
    .from('family_links')
    .select('id')
    .eq('org_id', orgId)
    .eq('guardian_account_id', currentAccount.id)
    .eq('child_account_id', requestedProfile.account_id)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (familyLinkError) throw familyLinkError;
  if (familyLink?.id) return requestedSenderProfileId;

  let fallbackProfileId = currentAccount.active_profile_id;
  if (fallbackProfileId) {
    const { data: fallbackProfile, error: fallbackProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', fallbackProfileId)
      .eq('account_id', currentAccount.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();

    if (fallbackProfileError) throw fallbackProfileError;
    if (fallbackProfile?.id) {
      logMessageMutation('senderProfile:fallback', {
        orgId,
        requestedSenderProfileId,
        resolvedSenderProfileId: fallbackProfile.id,
        currentAccountId: currentAccount.id,
      });
      return fallbackProfile.id;
    }
  }

  const { data: firstOwnedProfile, error: firstOwnedProfileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('account_id', currentAccount.id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (firstOwnedProfileError) throw firstOwnedProfileError;
  if (firstOwnedProfile?.id) {
    logMessageMutation('senderProfile:fallback', {
      orgId,
      requestedSenderProfileId,
      resolvedSenderProfileId: firstOwnedProfile.id,
      currentAccountId: currentAccount.id,
    });
    return firstOwnedProfile.id;
  }

  return requestedSenderProfileId;
}

async function resolveDmSenderProfileId(
  orgId: string,
  channelId: string,
  requestedSenderProfileId: string,
  writableSenderProfileId: string,
): Promise<string> {
  const { data: channel, error: channelError } = await supabase
    .from('channels')
    .select('id, kind')
    .eq('id', channelId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle<ChannelKindLookupRow>();

  if (channelError) throw channelError;
  if (!channel || channel.kind !== 'dm') return writableSenderProfileId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return writableSenderProfileId;

  const { data: currentAccount, error: accountError } = await supabase
    .from('accounts')
    .select('id, org_id, active_profile_id')
    .eq('auth_user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle<CurrentAccountLookupRow>();

  if (accountError) throw accountError;
  if (!currentAccount?.id) return writableSenderProfileId;

  const { data: channelMembers, error: membersError } = await supabase
    .from('channel_members')
    .select('profile_id')
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null);

  if (membersError) throw membersError;

  const memberProfileIds = Array.from(
    new Set(
      (channelMembers ?? [])
        .map((member) => (member.profile_id as string | undefined) ?? '')
        .filter(Boolean),
    ),
  );

  if (!memberProfileIds.length) return writableSenderProfileId;
  if (memberProfileIds.includes(writableSenderProfileId)) return writableSenderProfileId;

  const { data: familyLinks, error: familyLinksError } = await supabase
    .from('family_links')
    .select('child_account_id')
    .eq('org_id', orgId)
    .eq('guardian_account_id', currentAccount.id)
    .is('deleted_at', null);

  if (familyLinksError) throw familyLinksError;

  const candidateAccountIds = Array.from(
    new Set([
      currentAccount.id,
      ...(familyLinks ?? [])
        .map((link) => (link.child_account_id as string | undefined) ?? '')
        .filter(Boolean),
    ]),
  );

  const { data: writableMemberProfiles, error: writableProfilesError } = await supabase
    .from('profiles')
    .select('id, account_id, org_id')
    .eq('org_id', orgId)
    .in('id', memberProfileIds)
    .in('account_id', candidateAccountIds)
    .is('deleted_at', null);

  if (writableProfilesError) throw writableProfilesError;

  const typedProfiles = (writableMemberProfiles ?? []) as ProfileOwnershipLookupRow[];
  if (!typedProfiles.length) return writableSenderProfileId;

  const requestedWritableMember = typedProfiles.find(
    (profile) => profile.id === requestedSenderProfileId,
  );
  if (requestedWritableMember) return requestedWritableMember.id;

  if (currentAccount.active_profile_id) {
    const activeWritableMember = typedProfiles.find(
      (profile) => profile.id === currentAccount.active_profile_id,
    );
    if (activeWritableMember) {
      logMessageMutation('senderProfile:dm-fallback', {
        orgId,
        channelId,
        requestedSenderProfileId,
        writableSenderProfileId,
        resolvedSenderProfileId: activeWritableMember.id,
        currentAccountId: currentAccount.id,
      });
      return activeWritableMember.id;
    }
  }

  const ownedWritableMember = typedProfiles.find(
    (profile) => profile.account_id === currentAccount.id,
  );
  if (ownedWritableMember) {
    logMessageMutation('senderProfile:dm-fallback', {
      orgId,
      channelId,
      requestedSenderProfileId,
      writableSenderProfileId,
      resolvedSenderProfileId: ownedWritableMember.id,
      currentAccountId: currentAccount.id,
    });
    return ownedWritableMember.id;
  }

  const linkedWritableMember = typedProfiles[0];
  if (linkedWritableMember) {
    logMessageMutation('senderProfile:dm-fallback', {
      orgId,
      channelId,
      requestedSenderProfileId,
      writableSenderProfileId,
      resolvedSenderProfileId: linkedWritableMember.id,
      currentAccountId: currentAccount.id,
    });
    return linkedWritableMember.id;
  }

  return writableSenderProfileId;
}

async function resolveThreadContextForSend(input: {
  orgId: string;
  channelId: string;
  senderProfileId: string;
  requestedThreadId?: string;
  threadParentId?: string;
  now: string;
}): Promise<{ threadId: string | null; threadCreated: boolean }> {
  if (!input.threadParentId) {
    return { threadId: input.requestedThreadId ?? null, threadCreated: false };
  }

  let threadId = input.requestedThreadId ?? null;
  let threadCreated = false;

  const { data: parentMessage, error: parentError } = await supabase
    .from('messages')
    .select('id, org_id, channel_id, sender_profile_id, thread_id, type')
    .eq('id', input.threadParentId)
    .maybeSingle<ParentMessageLookupRow>();

  if (parentError) throw parentError;
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
    const { data: existingThread, error: threadLookupError } = await supabase
      .from('threads')
      .select('id, parent_message_id, channel_id, org_id')
      .eq('id', threadId)
      .maybeSingle<ThreadLookupRow>();

    if (threadLookupError) throw threadLookupError;
    if (
      !existingThread ||
      existingThread.parent_message_id !== parentMessage.id ||
      existingThread.channel_id !== input.channelId ||
      existingThread.org_id !== input.orgId
    ) {
      threadId = null;
    }
  }

  if (!threadId) {
    const [snippet, authorName] = await Promise.all([
      loadMessageSnippet(parentMessage.id, parentMessage.type),
      loadProfileDisplayName(parentMessage.sender_profile_id),
    ]);

    const { data: insertedThread, error: threadInsertError } = await supabase
      .from('threads')
      .insert({
        org_id: input.orgId,
        channel_id: input.channelId,
        parent_message_id: parentMessage.id,
        snippet: snippet.slice(0, 140),
        author_id: parentMessage.sender_profile_id,
        author_name: authorName,
        message_count: 1,
        last_reply_at: input.now,
        created_at: input.now,
        created_by: input.senderProfileId,
        updated_at: input.now,
        updated_by: input.senderProfileId,
      })
      .select('id')
      .single<{ id: string }>();

    if (threadInsertError || !insertedThread) {
      throw threadInsertError ?? new Error('Unable to create thread.');
    }

    threadId = insertedThread.id;
    threadCreated = true;

    const { error: parentUpdateError } = await supabase
      .from('messages')
      .update({
        thread_id: threadId,
        updated_at: input.now,
        updated_by: input.senderProfileId,
      })
      .eq('id', parentMessage.id);

    if (parentUpdateError) throw parentUpdateError;
  }

  const participantRows = Array.from(
    new Set([parentMessage.sender_profile_id, input.senderProfileId]),
  ).map((profileId) => ({
    org_id: input.orgId,
    thread_id: threadId as string,
    profile_id: profileId,
    created_at: input.now,
    created_by: input.senderProfileId,
    updated_at: input.now,
    updated_by: input.senderProfileId,
  }));

  const { error: participantsError } = await supabase
    .from('thread_participants')
    .upsert(participantRows, { onConflict: 'org_id,thread_id,profile_id' });

  if (participantsError) throw participantsError;

  return { threadId, threadCreated };
}

async function bumpThreadReplyCount(input: {
  threadId: string | null;
  threadCreated: boolean;
  now: string;
  senderProfileId: string;
}): Promise<void> {
  if (!input.threadId || input.threadCreated) return;

  const { data: threadRow, error: threadLookupError } = await supabase
    .from('threads')
    .select('id, message_count')
    .eq('id', input.threadId)
    .maybeSingle<ThreadLookupRow>();

  if (threadLookupError) throw threadLookupError;
  if (!threadRow) return;

  const { error: threadUpdateError } = await supabase
    .from('threads')
    .update({
      message_count: (threadRow.message_count ?? 0) + 1,
      last_reply_at: input.now,
      updated_at: input.now,
      updated_by: input.senderProfileId,
    })
    .eq('id', input.threadId);

  if (threadUpdateError) throw threadUpdateError;
}

export async function sendTextMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  text: string,
  threadParentId?: string,
  threadId?: string,
) {
  const content = text.trim();
  if (!content) throw new Error('Message text is required');
  const writableSenderProfileId = await resolveWritableSenderProfileId(
    orgId,
    senderProfileId,
  );
  const resolvedSenderProfileId = await resolveDmSenderProfileId(
    orgId,
    channelId,
    senderProfileId,
    writableSenderProfileId,
  );

  logMessageMutation('sendTextMessage:start', {
    orgId,
    channelId,
    senderProfileId,
    resolvedSenderProfileId,
    threadParentId: threadParentId ?? null,
    threadId: threadId ?? null,
    contentLength: content.length,
  });

  try {
    const now = new Date().toISOString();
    const messageId = createClientUuid();
    const { threadId: resolvedThreadId, threadCreated } =
      await resolveThreadContextForSend({
        orgId,
        channelId,
        senderProfileId: resolvedSenderProfileId,
        requestedThreadId: threadId,
        threadParentId,
        now,
      });

    const { error: msgError } = await supabase.from('messages').insert({
      id: messageId,
      channel_id: channelId,
      sender_profile_id: resolvedSenderProfileId,
      org_id: orgId,
      type: 'text',
      thread_parent_id: threadParentId ?? null,
      ...(resolvedThreadId ? { thread_id: resolvedThreadId } : {}),
    });

    if (msgError) throw msgError;

    const { error: payloadError } = await supabase
      .from('message_text')
      .insert({ message_id: messageId, org_id: orgId, payload: { text: content } });

    if (payloadError) throw payloadError;

    await bumpThreadReplyCount({
      threadId: resolvedThreadId,
      threadCreated,
      now,
      senderProfileId: resolvedSenderProfileId,
    });

    logMessageMutation('sendTextMessage:success', {
      orgId,
      channelId,
      senderProfileId,
      resolvedSenderProfileId,
      messageId,
      threadId: resolvedThreadId ?? null,
    });

    return { id: messageId };
  } catch (error) {
    const typedError = error as { code?: string; message?: string };
    let debugContext: MessageWriteDebugContext | null = null;

    try {
      debugContext = await collectMessageWriteDebugContext({
        orgId,
        channelId,
        requestedSenderProfileId: senderProfileId,
        resolvedSenderProfileId,
      });
    } catch (debugError) {
      const typedDebugError = debugError as { message?: string };
      debugContext = {
        authUserId: null,
        currentAccountId: null,
        currentAccountOrgId: null,
        currentAccountActiveProfileId: null,
        requestedProfileAccountId: null,
        requestedProfileOrgId: null,
        requestedProfileKind: null,
        resolvedProfileAccountId: null,
        resolvedProfileOrgId: null,
        resolvedProfileKind: null,
        channelKind: null,
        channelPurpose: null,
        channelMemberProfileIds: [],
        debugCollectionError: typedDebugError.message ?? String(debugError),
      } as MessageWriteDebugContext & { debugCollectionError: string };
    }

    logMessageMutation(
      'sendTextMessage:error',
      {
        orgId,
        channelId,
        senderProfileId,
        resolvedSenderProfileId,
        threadParentId: threadParentId ?? null,
        threadId: threadId ?? null,
        errorCode: typedError.code ?? null,
        errorMessage: typedError.message ?? String(error),
        debugContext,
      },
      'error',
    );
    throw error;
  }
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
  const resolvedSenderProfileId = await resolveWritableSenderProfileId(
    orgId,
    senderProfileId,
  );
  const isImage = file.mimeType.startsWith('image/');
  const isAudio = file.mimeType.startsWith('audio/');
  const type = isImage ? 'image' : isAudio ? 'audio-recording' : 'file';
  logMessageMutation('sendFileMessage:start', {
    orgId,
    channelId,
    senderProfileId,
    resolvedSenderProfileId,
    threadParentId: threadParentId ?? null,
    threadId: threadId ?? null,
    type,
    fileName: file.name,
    mimeType: file.mimeType,
    storagePath: file.storagePath,
  });

  try {
    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        sender_profile_id: resolvedSenderProfileId,
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

    logMessageMutation('sendFileMessage:success', {
      orgId,
      channelId,
      senderProfileId,
      resolvedSenderProfileId,
      messageId: msg.id,
      table,
      type,
    });

    return msg;
  } catch (error) {
    const typedError = error as { code?: string; message?: string };
    logMessageMutation(
      'sendFileMessage:error',
      {
        orgId,
        channelId,
        senderProfileId,
        resolvedSenderProfileId,
        threadParentId: threadParentId ?? null,
        threadId: threadId ?? null,
        type,
        fileName: file.name,
        mimeType: file.mimeType,
        storagePath: file.storagePath,
        errorCode: typedError.code ?? null,
        errorMessage: typedError.message ?? String(error),
      },
      'error',
    );
    throw error;
  }
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
  const resolvedSenderProfileId = await resolveWritableSenderProfileId(
    orgId,
    senderProfileId,
  );
  const allImages = files.every((file) => file.mimeType.startsWith('image/'));
  const type = allImages ? 'image' : 'file';
  logMessageMutation('sendFilesMessage:start', {
    orgId,
    channelId,
    senderProfileId,
    resolvedSenderProfileId,
    threadParentId: threadParentId ?? null,
    threadId: threadId ?? null,
    type,
    fileCount: files.length,
    files: files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      storagePath: file.storagePath,
      size: file.size ?? null,
    })),
  });

  try {
    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        sender_profile_id: resolvedSenderProfileId,
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

    logMessageMutation('sendFilesMessage:success', {
      orgId,
      channelId,
      senderProfileId,
      resolvedSenderProfileId,
      messageId: msg.id,
      table,
      type,
      fileCount: files.length,
    });

    return msg;
  } catch (error) {
    const typedError = error as { code?: string; message?: string };
    logMessageMutation(
      'sendFilesMessage:error',
      {
        orgId,
        channelId,
        senderProfileId,
        resolvedSenderProfileId,
        threadParentId: threadParentId ?? null,
        threadId: threadId ?? null,
        type,
        fileCount: files.length,
        errorCode: typedError.code ?? null,
        errorMessage: typedError.message ?? String(error),
      },
      'error',
    );
    throw error;
  }
}
