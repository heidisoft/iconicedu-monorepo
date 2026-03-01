import { supabase } from '@/lib/supabase/client';
import { File as ExpoFile } from 'expo-file-system';
import type {
  UserProfileBlockVM,
  ChannelVM,
  LearningSpaceVM,
  MessageVM,
  ReactionVM,
  ThreadVM,
  ClassScheduleVM,
  EventSourceVM,
  RecurrenceVM,
  ClassScheduleParticipantVM,
  RecurrenceFrequencyVM,
  ParticipantRoleVM,
  ParticipationStatusVM,
  EventStatusVM,
  ClassScheduleVisibilityVM,
  ClassSchedulePatchVM,
} from '@iconicedu/shared-types';
import { mapRowToMessageVM, buildSenderProfile, type RawMessageRow, type RawSenderProfile } from './map-row-to-vm';

export const queryKeys = {
  profile: (profileId: string) => ['profile', profileId] as const,
  channels: (orgId: string) => ['channels', orgId] as const,
  directMessages: (orgId: string, profileId: string) =>
    ['directMessages', orgId, profileId] as const,
  channel: (channelId: string) => ['channel', channelId] as const,
  messages: (channelId: string) => ['messages', channelId] as const,
  learningSpaces: (orgId: string) => ['learningSpaces', orgId] as const,
  learningSpace: (spaceId: string) => ['learningSpace', spaceId] as const,
  inbox: (orgId: string, profileId: string) =>
    ['inbox', orgId, profileId] as const,
  sidebar: (orgId: string, profileId: string) =>
    ['sidebar', orgId, profileId] as const,
  notificationPrefs: (orgId: string, profileId: string) =>
    ['notificationPrefs', orgId, profileId] as const,
  familyLinks: (orgId: string, accountId: string) =>
    ['familyLinks', orgId, accountId] as const,
  childProfiles: (orgId: string, accountIds: string[]) =>
    ['childProfiles', orgId, accountIds] as const,
} as const;

/**
 * Mark the current user's account as 'active' after a successful login.
 * Mirrors the web's POST /api/accounts/activate status update step.
 * Non-throwing — a failed update is logged but never blocks the auth flow.
 */
export async function activateAccount(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const { error } = await supabase
    .from('accounts')
    .update({ status: 'active' })
    .eq('auth_user_id', session.user.id);

  if (error) {
    console.warn('[activateAccount] failed to set status=active:', error.message);
  }
}

export async function fetchUserAccount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Include the linked profile so callers don't need a second round-trip.
  const { data: account, error } = await supabase
    .from('accounts')
    .select('*, profile:profiles!account_id(id, display_name, first_name, last_name, avatar_seed)')
    .eq('auth_user_id', user.id)
    .single();

  if (error) throw error;
  return account;
}

export async function fetchProfile(profileId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error) throw error;
  return data;
}

/** Fetch the profile belonging to a given account (profiles.account_id → accounts.id). */
export async function fetchProfileByAccountId(accountId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export type DmParticipant = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
};

export type ChannelListItem = {
  id: string;
  org_id: string;
  topic: string | null;
  description: string | null;
  kind: string;
  updated_at: string;
  unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  /** Learning space subject emoji, e.g. "📐". */
  icon_emoji?: string | null;
  /** Primary student name this space is for. */
  student_name?: string | null;
  /** DM channel participants (other people, self excluded). */
  participants?: DmParticipant[];
};

export async function fetchDirectMessages(
  orgId: string,
  myProfileId: string,
): Promise<ChannelListItem[]> {
  if (!myProfileId) return [];

  // Step 1: get channel IDs where the logged-in user is a member
  // Uses channel_members (the correct table — mirrors web's channel_members table)
  const { data: myMemberships, error: myError } = await supabase
    .from('channel_members')
    .select('channel_id')
    .eq('profile_id', myProfileId)
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (myError) throw myError;
  if (!myMemberships || myMemberships.length === 0) return [];

  const userChannelIds = myMemberships.map((m) => m.channel_id);

  // Step 2: fetch only DM channels among the user's memberships
  const { data: chRows, error: chError } = await supabase
    .from('channels')
    .select('id, org_id, topic, description, kind, updated_at')
    .in('id', userChannelIds)
    .eq('org_id', orgId)
    .eq('kind', 'dm')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (chError) throw chError;
  if (!chRows || chRows.length === 0) return [];

  // Step 3: fetch all members for those channels to build name/avatar display
  const { data: memberRows } = await supabase
    .from('channel_members')
    .select('channel_id, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed)')
    .in('channel_id', chRows.map((c) => c.id))
    .is('deleted_at', null);

  // Build channelId → DmParticipant[] map, excluding self
  const participantMap = new Map<string, DmParticipant[]>();
  for (const member of memberRows ?? []) {
    const profile = member.profile as DmParticipant | null;
    if (!profile || profile.id === myProfileId) continue;
    const list = participantMap.get(member.channel_id) ?? [];
    list.push(profile);
    participantMap.set(member.channel_id, list);
  }

  const lastMessages = await fetchLastMessages(chRows.map((ch) => ch.id));

  return chRows.map((ch) => {
    const last = lastMessages.get(ch.id);
    return {
      id: ch.id,
      org_id: ch.org_id,
      topic: ch.topic ?? null,
      description: ch.description ?? null,
      kind: ch.kind,
      updated_at: ch.updated_at,
      unread_count: 0,
      last_message_text: last?.text ?? null,
      last_message_at: last?.at ?? null,
      last_message_sender: last?.sender ?? null,
      participants: participantMap.get(ch.id) ?? [],
    };
  });
}

// ─── Shared preview helper ────────────────────────────────────────────────────

type LastMessageInfo = { text: string | null; at: string | null; sender: string | null };

const PREVIEW_LABELS: Record<string, string> = {
  'image':                '🖼 Image',
  'file':                 '📎 File',
  'audio-recording':      '🎙 Voice message',
  'lesson-assignment':    '📚 Assignment',
  'homework-submission':  '📝 Homework submitted',
  'progress-update':      '📈 Progress update',
  'event-reminder':       '📅 Event reminder',
  'session-summary':      '📋 Session summary',
  'session-complete':     '✓ Session complete',
  'session-booking':      '🗓 Session booked',
  'payment-reminder':     '💳 Payment reminder',
  'feedback-request':     '💬 Feedback request',
};

/**
 * Batch-fetch the most recent message preview for a list of channel IDs.
 * Two queries: one for the latest message row per channel, one for text payloads.
 */
async function fetchLastMessages(channelIds: string[]): Promise<Map<string, LastMessageInfo>> {
  if (!channelIds.length) return new Map();

  type MsgRow = {
    id: string;
    channel_id: string;
    type: string;
    created_at: string;
    sender: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
  };

  // Fetch recent top-level messages (no thread replies), ordered newest-first.
  // Limit heuristic: 3 per channel gives enough headroom to find the latest per channel in JS.
  const { data: msgRows } = await supabase
    .from('messages')
    .select('id, channel_id, type, created_at, sender:profiles!sender_profile_id(display_name, first_name, last_name)')
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .is('thread_parent_id', null)
    .order('created_at', { ascending: false })
    .limit(channelIds.length * 3);

  if (!msgRows?.length) return new Map();

  const rows = msgRows as MsgRow[];

  // Pick the newest per channel (already DESC ordered)
  const latestByChannel = new Map<string, MsgRow>();
  for (const row of rows) {
    if (!latestByChannel.has(row.channel_id)) {
      latestByChannel.set(row.channel_id, row);
    }
  }

  // For text messages, fetch the actual payload text
  const textMessageIds = Array.from(latestByChannel.values())
    .filter((r) => r.type === 'text')
    .map((r) => r.id);

  const textByMessageId = new Map<string, string>();
  if (textMessageIds.length) {
    const { data: textRows } = await supabase
      .from('message_text')
      .select('message_id, payload')
      .in('message_id', textMessageIds);
    for (const t of textRows ?? []) {
      const text = ((t.payload as Record<string, unknown>)?.text as string | undefined)?.trim();
      if (text) textByMessageId.set(t.message_id, text);
    }
  }

  const result = new Map<string, LastMessageInfo>();
  for (const [channelId, row] of latestByChannel) {
    const text = row.type === 'text'
      ? (textByMessageId.get(row.id) ?? null)
      : (PREVIEW_LABELS[row.type] ?? null);
    const s = row.sender;
    const sender = s
      ? (s.display_name?.trim() || [s.first_name, s.last_name].filter(Boolean).join(' ') || null)
      : null;
    result.set(channelId, { text, at: row.created_at, sender });
  }

  return result;
}

export async function fetchChannels(orgId: string): Promise<ChannelListItem[]> {
  const { data, error } = await supabase
    .from('channels')
    .select(
      `
      id, org_id, topic, description, kind, updated_at,
      channel_read_state(unread_count)
    `,
    )
    .eq('org_id', orgId)
    .eq('kind', 'channel')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const lastMessages = await fetchLastMessages(data.map((ch) => ch.id));

  return data.map((ch) => {
    const readState = (ch.channel_read_state as Array<{ unread_count: number | null }> | null)?.[0];
    const last = lastMessages.get(ch.id);
    return {
      id: ch.id,
      org_id: ch.org_id,
      topic: ch.topic,
      description: ch.description,
      kind: ch.kind,
      updated_at: ch.updated_at,
      unread_count: readState?.unread_count ?? 0,
      last_message_text: last?.text ?? null,
      last_message_at: last?.at ?? null,
      last_message_sender: last?.sender ?? null,
    };
  });
}

// messages table has no `content` column — payloads are in type-specific tables.
// Only select columns that actually exist on the messages table.
const BASE_MESSAGE_SELECT = `
  id, org_id, channel_id, sender_profile_id, type, created_at, updated_at, thread_parent_id,
  sender:profiles!sender_profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed)
`;

/** message type → payload table name */
const TYPE_TABLE: Record<string, string> = {
  'text':                 'message_text',
  'image':                'message_image',
  'file':                 'message_file',
  'audio-recording':      'message_audio_recording',
  'link-preview':         'message_link_preview',
  'lesson-assignment':    'message_lesson_assignment',
  'homework-submission':  'message_homework_submission',
  'progress-update':      'message_progress_update',
  'event-reminder':       'message_event_reminder',
  'session-summary':      'message_session_summary',
  'session-complete':     'message_session_complete',
  'session-booking':      'message_session_booking',
  'payment-reminder':     'message_payment_reminder',
  'feedback-request':     'message_feedback_request',
};

/** Batch-fetch payloads from type-specific tables, grouped by message_id. */
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
        .then(({ data }: { data: Array<{ message_id: string; payload: Record<string, unknown> }> | null }) => {
          for (const row of data ?? []) {
            payloadMap.set(row.message_id, row.payload);
          }
        }),
    );
  }

  await Promise.all(fetches);
  return payloadMap;
}

/** Fetch message_reactions rows and group into ReactionVM[] per message_id. */
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
  for (const r of (reactionRows ?? []) as Array<{ message_id: string; emoji: string; account_id: string }>) {
    const bucket = grouped.get(r.message_id) ?? [];
    bucket.push({ emoji: r.emoji, account_id: r.account_id });
    grouped.set(r.message_id, bucket);
  }

  const result = new Map<string, ReactionVM[]>();
  for (const [messageId, rawReactions] of grouped) {
    const byEmoji = new Map<string, string[]>();
    for (const r of rawReactions) {
      const accounts = byEmoji.get(r.emoji) ?? [];
      accounts.push(r.account_id);
      byEmoji.set(r.emoji, accounts);
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

// Matches ThreadRow from @iconicedu/shared-types/rows/message
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

/**
 * Fetch threads from the canonical `threads` table (mirrors web's buildThreadsByChannelId).
 * Returns a map of parent_message_id → ThreadVM.
 */
async function loadThreads(
  parentMessageIds: string[],
): Promise<Map<string, ThreadVM>> {
  if (!parentMessageIds.length) return new Map();

  const { data: threadRows, error: threadError } = await supabase
    .from('threads')
    .select('id, org_id, channel_id, parent_message_id, snippet, author_id, author_name, message_count, last_reply_at, created_at')
    .in('parent_message_id', parentMessageIds);

  if (threadError) {
    console.warn('[loadThreads] threads query failed:', threadError.message);
    return new Map();
  }
  if (!threadRows || threadRows.length === 0) return new Map();

  const typedThreadRows = threadRows as RawThreadRow[];
  const threadIds = typedThreadRows.map((t) => t.id);

  const { data: participantRows, error: participantError } = await supabase
    .from('thread_participants')
    .select('thread_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed)')
    .in('thread_id', threadIds)
    .is('deleted_at', null);

  if (participantError) {
    console.warn('[loadThreads] participants query failed:', participantError.message);
  }

  // Build thread_id → participants map
  const participantsByThread = new Map<string, RawSenderProfile[]>();
  for (const p of (participantRows ?? []) as RawThreadParticipantRow[]) {
    if (!p.profile) continue;
    const list = participantsByThread.get(p.thread_id) ?? [];
    list.push(p.profile);
    participantsByThread.set(p.thread_id, list);
  }

  const result = new Map<string, ThreadVM>();
  for (const t of typedThreadRows) {
    const participants = (participantsByThread.get(t.id) ?? []).map((p) =>
      buildSenderProfile(p, t.org_id),
    );
    // Map exactly as web's mapThreadRowToVM does
    result.set(t.parent_message_id, {
      ids: { id: t.id, orgId: t.org_id },
      parent: {
        messageId: t.parent_message_id,
        snippet: t.snippet ?? undefined,
        authorId: t.author_id ?? undefined,
        authorName: t.author_name ?? undefined,
      },
      stats: {
        messageCount: t.message_count ?? 0,
        lastReplyAt: t.last_reply_at ?? t.created_at,  // fallback = thread created_at
      },
      participants,
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

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const typedRows = rows as RawMessageRow[];
  const messageIds = typedRows.map((r) => r.id);

  const [payloadMap, reactionMap, threadsMap] = await Promise.all([
    loadPayloads(typedRows),
    loadReactions(messageIds, currentAccountId),
    loadThreads(messageIds),
  ]);

  // Reverse a copy (oldest→newest) without mutating the typed rows array.
  return [...typedRows].reverse().map((row) =>
    mapRowToMessageVM(
      row,
      payloadMap.get(row.id) ?? null,
      reactionMap.get(row.id) ?? [],
      threadsMap.get(row.id),
    ),
  );
}

/**
 * Fetch reply messages for a thread.
 * Mirrors web's approach: queries by thread_id (FK to threads table) which is
 * set on every reply message. Falls back to thread_parent_id for mobile-only replies.
 *
 * @param threadId   - The threads.id (from ThreadVM.ids.id) — preferred
 * @param parentMessageId - The parent message's id — fallback if threadId unknown
 */
export async function fetchThreadMessages(
  threadId: string,
  parentMessageId: string,
  currentProfileId = '',
  currentAccountId = '',
): Promise<MessageVM[]> {
  // Try thread_id first (web-aligned — replies have thread_id → threads.id).
  // Exclude the parent message itself: sendTextMessage sets thread_id on the parent
  // too (as a FK link), so without this filter it would appear twice in the thread.
  let { data: rows, error } = await supabase
    .from('messages')
    .select(BASE_MESSAGE_SELECT)
    .eq('thread_id', threadId)
    .neq('id', parentMessageId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  // If no results, fall back to thread_parent_id (used by mobile sendTextMessage)
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
  if (!rows || rows.length === 0) return [];

  const typedRows = rows as RawMessageRow[];
  const messageIds = typedRows.map((r) => r.id);

  const [payloadMap, reactionMap] = await Promise.all([
    loadPayloads(typedRows),
    loadReactions(messageIds, currentAccountId),
  ]);

  return typedRows.map((row) =>
    mapRowToMessageVM(
      row,
      payloadMap.get(row.id) ?? null,
      reactionMap.get(row.id) ?? [],
    ),
  );
}

export async function toggleReaction(
  messageId: string,
  accountId: string,
  emoji: string,
  orgId: string,
): Promise<void> {
  // org_id is required (NOT NULL) — omitting it causes a silent constraint violation
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

  if (existing) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('org_id', orgId)
      .eq('message_id', messageId)
      .eq('account_id', accountId)
      .eq('emoji', emoji);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('message_reactions')
      .insert({ org_id: orgId, message_id: messageId, account_id: accountId, emoji });
    if (error) throw error;
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function fetchLearningSpaces(orgId: string) {
  const { data, error } = await supabase
    .from('learning_spaces')
    .select(
      `
      id, org_id, kind, status, title, icon_key, subject, description, updated_at,
      learning_space_channels(channel_id, is_primary, channel:channels!channel_id(*))
    `,
    )
    .eq('org_id', orgId)
    .in('status', ['active', 'paused'])
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Emoji icon for each learning space icon_key (Lucide icon keys mapped to emoji equivalents). */
const SPACE_ICON_EMOJI: Record<string, string> = {
  'square-pi': '📐',
  'languages': '🌐',
  'chef-hat': '👨‍🍳',
  'earth': '🌍',
  'sparkles': '✨',
  'book-open': '📖',
  'flask-conical': '🧪',
  'music': '🎵',
  'palette': '🎨',
  'dumbbell': '🏋️',
};

/**
 * Fetches learning space primary channels for the messages tab, scoped to
 * spaces the logged-in user participates in.
 * Mirrors web's learning_space_participants filtering pattern.
 */
export async function fetchLearningSpaceChannels(
  orgId: string,
  myProfileId: string,
): Promise<ChannelListItem[]> {
  if (!myProfileId) return [];

  // Step 1: get learning space IDs where the user is a participant
  // Uses learning_space_participants (mirrors web's getLearningSpaceParticipantsByLearningSpaceIds)
  const { data: mySpaces, error: spError } = await supabase
    .from('learning_space_participants')
    .select('learning_space_id')
    .eq('profile_id', myProfileId)
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (spError) throw spError;
  if (!mySpaces || mySpaces.length === 0) return [];

  const userSpaceIds = mySpaces.map((s) => s.learning_space_id);

  // Step 2: fetch primary channels for those learning spaces
  const { data, error } = await supabase
    .from('learning_space_channels')
    .select(
      `
      channel_id,
      space:learning_spaces!learning_space_id(id, title, icon_key, subject, status, deleted_at),
      channel:channels!channel_id(id, org_id, updated_at)
      `,
    )
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .in('learning_space_id', userSpaceIds)
    .is('deleted_at', null);

  if (error) throw error;

  type Row = typeof data extends (infer R)[] | null ? R : never;
  const toSpace = (r: Row) => r.space as { id: string; title: string; icon_key: string | null; subject: string | null; status: string; deleted_at: string | null } | null;
  const toChannel = (r: Row) => r.channel as { id: string; org_id: string; updated_at: string } | null;

  const items = (data ?? [])
    .filter((row) => {
      const sp = toSpace(row);
      const ch = toChannel(row);
      return sp && ch && !sp.deleted_at && (sp.status === 'active' || sp.status === 'paused');
    })
    .map((row) => {
      const sp = toSpace(row)!;
      const ch = toChannel(row)!;
      return {
        id: ch.id,
        org_id: ch.org_id,
        topic: sp.title,
        description: sp.subject ?? null,
        kind: 'channel' as const,
        updated_at: ch.updated_at,
        unread_count: 0,
        last_message_text: null as string | null,
        last_message_at: null as string | null,
        last_message_sender: null as string | null,
        icon_emoji: SPACE_ICON_EMOJI[sp.icon_key ?? ''] ?? null,
        student_name: null,
      };
    });

  const lastMessages = await fetchLastMessages(items.map((i) => i.id));

  return items.map((item) => {
    const last = lastMessages.get(item.id);
    return {
      ...item,
      last_message_text: last?.text ?? null,
      last_message_at: last?.at ?? null,
      last_message_sender: last?.sender ?? null,
    };
  });
}

export async function fetchNotificationPreferences(orgId: string, profileId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('org_id', orgId)
    .eq('profile_id', profileId)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}

export async function fetchFamilyLinks(orgId: string, guardianAccountId: string) {
  const { data, error } = await supabase
    .from('family_links')
    .select('*')
    .eq('org_id', orgId)
    .eq('guardian_account_id', guardianAccountId)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfilesByAccountIds(orgId: string, accountIds: string[]) {
  if (!accountIds.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, account_id, display_name, first_name, last_name, avatar_seed, kind')
    .eq('org_id', orgId)
    .in('account_id', accountIds)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}

const MOBILE_ALLOWED_ROLES = new Set(['educator', 'guardian', 'child', 'staff', 'admin', 'system']);

export type DayAvailability = Record<string, Array<{ start: string; end: string }>>;

export type OnboardingStatus = {
  isComplete: boolean;
  isRoleAllowed: boolean;
  profileId: string | null;
  accountId: string | null;
  orgId: string | null;
  primaryRole: string | null;
  profileKind: string | null;
  flags: {
    hasName: boolean;
    hasTimezone: boolean;
    hasLocation: boolean;
    hasPhone: boolean;
    requiresPhone: boolean;
    hasRoleData: boolean;
    hasAvailability: boolean;
  };
  prefill: {
    firstName: string;
    lastName: string;
    phone: string;
    timezone: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
  };
};

export function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Account lookup timed out. Please check your connection and try again.')),
      12_000,
    ),
  );
  return Promise.race([_doFetchOnboardingStatus(), timeout]);
}

async function _doFetchOnboardingStatus(): Promise<OnboardingStatus> {
  // getSession() reads from SecureStore — no network request, no hang risk.
  // getUser() verifies with the auth server over the network and can hang indefinitely.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  // Try to find account by auth_user_id first
  const { data: accountByAuthId, error: accountError } = await supabase
    .from('accounts')
    .select('id, org_id, onboarding_completed_at, primary_role, phone_e164')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (accountError) {
    console.error('[onboarding] account fetch error:', accountError);
    throw accountError;
  }

  let account = accountByAuthId;

  // Fallback: if account isn't linked yet, try to find it by email and link it.
  // This handles the case where the account was pre-created by an admin but
  // auth_user_id was never set (activate endpoint normally does this on web).
  if (!account && user.email) {
    const { data: accountByEmail } = await supabase
      .from('accounts')
      .select('id, org_id, onboarding_completed_at, primary_role, phone_e164')
      .eq('email', user.email.trim().toLowerCase())
      .maybeSingle();

    if (accountByEmail) {
      // Attempt to link this auth user to the account (requires RLS to allow it)
      await supabase
        .from('accounts')
        .update({ auth_user_id: user.id })
        .eq('id', accountByEmail.id);
      account = accountByEmail;
    }
  }

  if (!account) throw new Error('No account found for this user. Please contact your administrator.');

  // Profiles are linked via account_id on the profiles table (not the other way around)
  let profileId: string | null = null;
  let profileKind: string | null = null;
  let firstName = '';
  let lastName = '';
  let timezone = '';
  let city = '';
  let region = '';
  let postalCode = '';
  let countryCode = '';

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, kind, first_name, last_name, timezone, city, region, postal_code, country_code')
    .eq('account_id', account.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (profileError) console.warn('[onboarding] profile fetch error:', profileError);
  if (profile) {
    profileId   = profile.id;
    profileKind = profile.kind ?? null;
    firstName   = profile.first_name ?? '';
    lastName    = profile.last_name ?? '';
    timezone    = profile.timezone ?? '';
    city        = (profile as Record<string, unknown>).city as string ?? '';
    region      = (profile as Record<string, unknown>).region as string ?? '';
    postalCode  = (profile as Record<string, unknown>).postal_code as string ?? '';
    countryCode = (profile as Record<string, unknown>).country_code as string ?? '';
  }

  const kind = profileKind ?? account.primary_role ?? null;

  // Mirror web's determineOnboardingStep required-field checks:
  const hasName     = !!firstName.trim() && !!lastName.trim();
  const hasTimezone = !!timezone.trim() && timezone.trim() !== 'UTC';
  const hasLocation = !!city.trim() && !!region.trim();
  const requiresPhone = kind !== 'child';
  const hasPhone    = !!(account.phone_e164?.trim());

  // Role-specific checks (child: grade set; educator: subjects + grade levels set)
  let hasRoleData = true;
  if (kind === 'child' && profileId) {
    const { data: gradeRows } = await supabase
      .from('child_profile_grade_level')
      .select('grade_id')
      .eq('profile_id', profileId)
      .limit(1);
    hasRoleData = (gradeRows?.length ?? 0) > 0;
  } else if (kind === 'educator' && profileId) {
    const [{ data: subjectRows }, { data: gradeRows }] = await Promise.all([
      supabase.from('educator_profile_subjects').select('subject').eq('profile_id', profileId).limit(1),
      supabase.from('educator_profile_grade_levels').select('grade_id').eq('profile_id', profileId).limit(1),
    ]);
    hasRoleData = (subjectRows?.length ?? 0) > 0 && (gradeRows?.length ?? 0) > 0;
  }

  // Availability check for educators
  let hasAvailability = kind !== 'educator';
  if (kind === 'educator' && profileId) {
    const { data: availRows } = await supabase
      .from('educator_availabilities')
      .select('profile_id')
      .eq('profile_id', profileId)
      .limit(1);
    hasAvailability = (availRows?.length ?? 0) > 0;
  }

  const isComplete =
    hasName &&
    hasTimezone &&
    hasLocation &&
    (!requiresPhone || hasPhone) &&
    hasRoleData &&
    hasAvailability;

  // All roles are allowed on mobile. Unknown/null roles pass through so the wizard can collect them.
  const isRoleAllowed = kind === null || MOBILE_ALLOWED_ROLES.has(kind);

  return {
    isComplete,
    isRoleAllowed,
    profileId,
    accountId: account.id,
    orgId: account.org_id,
    primaryRole: account.primary_role ?? null,
    profileKind,
    flags: { hasName, hasTimezone, hasLocation, hasPhone, requiresPhone, hasRoleData, hasAvailability },
    prefill: {
      firstName,
      lastName,
      phone: account.phone_e164 ?? '',
      timezone,
      city,
      region,
      postalCode,
      countryCode,
    },
  };
}

// ─── Wizard step saves ─────────────────────────────────────────────────────────

export async function saveNameStep(profileId: string, firstName: string, lastName: string) {
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const { error } = await supabase
    .from('profiles')
    .update({ first_name: firstName.trim(), last_name: lastName.trim(), display_name: displayName })
    .eq('id', profileId);
  if (error) throw error;
}

export async function savePhoneStep(accountId: string, phone: string) {
  const { error } = await supabase
    .from('accounts')
    .update({ phone_e164: phone.trim() || null })
    .eq('id', accountId);
  if (error) throw error;
}

export async function saveTimezoneStep(profileId: string, timezone: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', profileId);
  if (error) throw error;
}

export async function saveStudentStep(
  profileId: string,
  orgId: string,
  birthYear: number | null,
  gradeLevel: string | null,
) {
  const { error: profileError } = await supabase
    .from('child_profiles')
    .upsert({ profile_id: profileId, org_id: orgId, birth_year: birthYear }, { onConflict: 'profile_id' });
  if (profileError) throw profileError;

  if (gradeLevel) {
    await supabase.from('child_profile_grade_level').delete().eq('profile_id', profileId);
    const { error: gradeError } = await supabase
      .from('child_profile_grade_level')
      .insert({ profile_id: profileId, org_id: orgId, grade_id: gradeLevel });
    if (gradeError) throw gradeError;
  }
}

export async function saveLocationStep(
  profileId: string,
  city: string,
  region: string,
  postalCode: string,
  countryCode: string,
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      city: city.trim() || null,
      region: region.trim() || null,
      postal_code: postalCode.trim() || null,
      country_code: countryCode || null,
    } as Record<string, unknown>)
    .eq('id', profileId);
  if (error) throw error;
}

export async function saveEducatorProfileStep(
  profileId: string,
  orgId: string,
  subjects: string[],
  gradeLevels: string[],
) {
  // Save subjects
  await supabase.from('educator_profile_subjects').delete().eq('profile_id', profileId);
  if (subjects.length > 0) {
    const subjectRows = subjects.map((subject) => ({ profile_id: profileId, org_id: orgId, subject }));
    const { error } = await supabase.from('educator_profile_subjects').insert(subjectRows);
    if (error) throw error;
  }

  // Save grade levels
  await supabase.from('educator_profile_grade_levels').delete().eq('profile_id', profileId);
  if (gradeLevels.length > 0) {
    const gradeRows = gradeLevels.map((grade_id) => ({ profile_id: profileId, org_id: orgId, grade_id }));
    const { error } = await supabase.from('educator_profile_grade_levels').insert(gradeRows);
    if (error) throw error;
  }
}

export async function saveEducatorAvailabilityStep(
  profileId: string,
  orgId: string,
  classTypes: string[],
  weeklyCommitment: number | null,
  availability: DayAvailability,
) {
  const { error } = await supabase
    .from('educator_availabilities')
    .upsert(
      { profile_id: profileId, org_id: orgId, class_types: classTypes, weekly_commitment: weeklyCommitment, availability },
      { onConflict: 'profile_id' },
    );
  if (error) throw error;
}

export async function completeOnboarding(accountId: string) {
  const { error } = await supabase
    .from('accounts')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', accountId)
    .is('onboarding_completed_at', null);
  if (error) throw error;
}

export async function sendTextMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  text: string,
  threadParentId?: string,
  threadId?: string,  // threads.id — set when replying to existing thread
) {
  const now = new Date().toISOString();
  let resolvedThreadId = threadId;

  // ── Thread lifecycle (replies only) ──────────────────────────────────────
  if (threadParentId) {
    if (!resolvedThreadId) {
      // ─ New thread: fetch parent message context, then create threads row ─
      const [{ data: parentMsg }, { data: parentText }] = await Promise.all([
        supabase
          .from('messages')
          .select('sender_profile_id, sender:profiles!sender_profile_id(display_name, first_name, last_name)')
          .eq('id', threadParentId)
          .maybeSingle(),
        supabase
          .from('message_text')
          .select('payload')
          .eq('message_id', threadParentId)
          .maybeSingle(),
      ]);

      type ParentSenderShape = { display_name: string | null; first_name: string | null; last_name: string | null };
      const parentSenderProfileId =
        (parentMsg as { sender_profile_id?: string } | null)?.sender_profile_id ?? null;
      const parentSender =
        (parentMsg as { sender?: ParentSenderShape } | null)?.sender ?? null;
      const authorName =
        parentSender?.display_name?.trim() ||
        [parentSender?.first_name, parentSender?.last_name].filter(Boolean).join(' ') ||
        null;
      // Use parent message text as snippet (thread context); fall back to reply text
      const snippet =
        ((parentText?.payload as Record<string, unknown> | null)?.text as string | undefined)
          ?.slice(0, 100) ?? text.slice(0, 100);

      // Create the threads row (mirrors web's sendTextMessageAction)
      const { data: newThread, error: threadError } = await supabase
        .from('threads')
        .insert({
          org_id: orgId,
          channel_id: channelId,
          parent_message_id: threadParentId,
          snippet,
          author_id: parentSenderProfileId,
          author_name: authorName,
          message_count: 1,
          last_reply_at: now,
        })
        .select('id')
        .single();

      if (threadError) throw threadError;
      resolvedThreadId = newThread.id;

      // Update parent message thread_id FK so loadThreads can find it
      await supabase
        .from('messages')
        .update({ thread_id: resolvedThreadId })
        .eq('id', threadParentId);

      // Add participants: parent author + reply sender (deduped)
      const participantIds = Array.from(
        new Set([senderProfileId, ...(parentSenderProfileId ? [parentSenderProfileId] : [])]),
      );
      await supabase
        .from('thread_participants')
        .upsert(
          participantIds.map((profileId) => ({
            thread_id: resolvedThreadId!,
            org_id: orgId,
            profile_id: profileId,
          })),
          { ignoreDuplicates: true },
        );
    } else {
      // ─ Existing thread: increment message_count, update last_reply_at, upsert participant ─
      const { data: threadRow } = await supabase
        .from('threads')
        .select('message_count')
        .eq('id', resolvedThreadId)
        .single();

      await supabase
        .from('threads')
        .update({
          message_count: (threadRow?.message_count ?? 0) + 1,
          last_reply_at: now,
        })
        .eq('id', resolvedThreadId);

      await supabase
        .from('thread_participants')
        .upsert(
          [{ thread_id: resolvedThreadId, org_id: orgId, profile_id: senderProfileId }],
          { ignoreDuplicates: true },
        );
    }
  }

  // ── Insert the message row ───────────────────────────────────────────────
  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      sender_profile_id: senderProfileId,
      org_id: orgId,
      type: 'text',
      thread_parent_id: threadParentId ?? null,
      ...(resolvedThreadId ? { thread_id: resolvedThreadId } : {}),
    })
    .select('id')
    .single();

  if (msgError) throw msgError;

  // ── Insert the text payload ──────────────────────────────────────────────
  const { error: textError } = await supabase
    .from('message_text')
    .insert({
      message_id: msg.id,
      org_id: orgId,
      payload: { text },
    });

  if (textError) throw textError;
  return msg;
}

// ─── File / Image / Audio upload + message creation ───────────────────────────
// Mirrors the web's uploadFileMessage flow (messages-shell-client.tsx) and
// sendFileMessageAction / sendFilesMessageAction (apps/web/app/actions/messages.ts).

const CHANNEL_FILES_BUCKET = 'channel-files';

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  const baseName = sanitizeStorageFileName(name.replace(/\.[^/.]+$/, '')).replace(/\.+$/g, '');
  return ext ? `${timestamp}-${randomSuffix}-${baseName}.${ext}` : `${timestamp}-${randomSuffix}-${baseName}`;
}

/**
 * Build a storage path identical to the web's buildMessageAssetPath helper.
 * Format: {orgId}/{channelId}/{assetKind}/{profileId}/{timestamp}-{random}-{name}.{ext}
 */
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

/**
 * Decode a pre-read base64 string (from expo-image-picker) into a Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Upload a local file URI to the channel-files Supabase bucket.
 *
 * Mirrors the web's supabase.storage.from(bucket).upload(path, blob, opts) call.
 *
 * - Images: carry pre-read base64 from expo-image-picker (base64: true option).
 *   Decoded directly to Uint8Array — no filesystem read needed.
 * - Docs / audio: file:// URI (DocumentPicker copyToCacheDirectory: true, or expo-av).
 *   Read synchronously via the new expo-file-system File.bytes() API (SDK 54+).
 */
export async function uploadChannelFile(
  localUri: string,
  storagePath: string,
  mimeType: string,
  prereadBase64?: string,
): Promise<void> {
  const data: Uint8Array = prereadBase64
    ? base64ToUint8Array(prereadBase64)
    : new ExpoFile(localUri).bytes();

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
  durationSeconds?: number; // audio only
};

/**
 * Insert a single file / image / audio-recording message.
 * Mirrors web's sendFileMessageAction — same tables, same payload shape.
 */
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

  const table = isImage ? 'message_image' : isAudio ? 'message_audio_recording' : 'message_file';
  const { error: payloadError } = await supabase
    .from(table)
    .insert({ message_id: msg.id, org_id: orgId, payload });

  if (payloadError) throw payloadError;
  return msg;
}

/**
 * Insert multiple images or files as a single message with an attachments array.
 * Mirrors web's sendFilesMessageAction — same payload shape with attachments[].
 * Audio must be sent individually via sendFileMessage.
 */
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
  const allImages = files.every((f) => f.mimeType.startsWith('image/'));
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

  // Build attachments array — identical to web's sendFilesMessageAction payload shape
  const attachmentsPayload = files.map((f) => ({
    url: f.storagePath,
    storagePath: f.storagePath,
    name: f.name,
    ...(f.size !== undefined ? { size: f.size } : {}),
    mimeType: f.mimeType,
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

// ─── Class Schedule Mapper ─────────────────────────────────────────────────────

function mapClassScheduleRow(row: Record<string, unknown>): ClassScheduleVM {
  const orgId = row.org_id as string;

  // Map recurrence
  const recurrenceRows = row.recurrence as Record<string, unknown>[] | null;
  const recurrenceRow = recurrenceRows?.[0];
  const recurrence: RecurrenceVM | undefined = recurrenceRow
    ? {
        ids: { id: recurrenceRow.id as string, orgId },
        rule: {
          frequency: recurrenceRow.frequency as RecurrenceFrequencyVM,
          interval: (recurrenceRow.interval as number | null) ?? undefined,
          byWeekday: (recurrenceRow.byday as string[] | null) as RecurrenceVM['rule']['byWeekday'] ?? undefined,
          count: (recurrenceRow.count as number | null) ?? undefined,
          until: (recurrenceRow.until as string | null) ?? undefined,
          timezone: (recurrenceRow.timezone as string | null) ?? undefined,
        },
        exceptions: ((recurrenceRow.exceptions as Record<string, unknown>[]) ?? []).map((e) => ({
          occurrenceKey: e.occurrence_key as string,
          reason: (e.reason as string | null) ?? undefined,
        })),
        overrides: ((recurrenceRow.overrides as Record<string, unknown>[]) ?? []).map((o) => ({
          occurrenceKey: o.occurrence_key as string,
          patch: o.patch as ClassSchedulePatchVM,
        })),
      }
    : undefined;

  // Map source
  const sourceKind = row.source_kind as string;
  let source: EventSourceVM;
  if (sourceKind === 'class_session') {
    source = {
      kind: 'class_session',
      learningSpaceId: row.source_learning_space_id as string,
      channelId: (row.source_channel_id as string | null) ?? undefined,
      sessionId: (row.source_session_id as string | null) ?? undefined,
    };
  } else if (sourceKind === 'availability_block') {
    source = { kind: 'availability_block', ownerUserId: row.source_owner_user_id as string };
  } else {
    source = {
      kind: 'manual',
      createdByUserId: row.source_created_by_user_id as string,
      relatedTo: row.source_related_learning_space_id
        ? { kind: 'learning_space', id: row.source_related_learning_space_id as string }
        : undefined,
    };
  }

  // Map participants
  const participants: ClassScheduleParticipantVM[] = (
    (row.participants as Record<string, unknown>[]) ?? []
  ).map((p) => ({
    ids: { id: p.id as string, orgId },
    role: p.role as ParticipantRoleVM,
    status: (p.status as ParticipationStatusVM | null) ?? undefined,
    displayName: (p.display_name as string | null) ?? undefined,
    avatarUrl: (p.avatar_url as string | null) ?? undefined,
    themeKey: (p.theme_key as string | null) ?? undefined,
  }));

  return {
    ids: { id: row.id as string, orgId },
    title: row.title as string,
    description: (row.description as string | null) ?? undefined,
    location: (row.location as string | null) ?? undefined,
    meetingLink: (row.meeting_link as string | null) ?? undefined,
    startAt: row.start_at as string,
    endAt: row.end_at as string,
    timezone: (row.timezone as string | null) ?? undefined,
    status: row.status as EventStatusVM,
    visibility: row.visibility as ClassScheduleVisibilityVM,
    themeKey: (row.theme_key as string | null) ?? undefined,
    participants,
    source,
    recurrence,
    audit: {
      createdAt: row.created_at as string,
      createdBy: row.created_by as string,
      updatedAt: (row.updated_at as string | null) ?? undefined,
      updatedBy: (row.updated_by as string | null) ?? undefined,
    },
  };
}

// ─── Space Sessions ────────────────────────────────────────────────────────────

/**
 * Fetches class schedules for the learning space that owns the given channel.
 * Sessions are a learning-space concern — decoupled from channel messaging logic.
 *
 * Strategy: prefer the learning-space link (source_learning_space_id) which is the
 * authoritative relationship. If no learning_space_channels row exists yet, fall back
 * to matching source_channel_id directly — same as the web approach.
 */
export async function fetchSpaceSchedulesByChannelId(
  channelId: string,
  orgId: string,
): Promise<ClassScheduleVM[]> {
  // Step 1: Resolve channel → learning space (optional — used when available)
  const { data: spaceLink } = await supabase
    .from('learning_space_channels')
    .select('learning_space_id')
    .eq('org_id', orgId)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .maybeSingle();

  const selectFragment = `
    id, org_id, title, description, location, meeting_link,
    start_at, end_at, timezone, status, visibility, theme_key,
    source_kind, source_learning_space_id, source_channel_id,
    source_session_id, source_owner_user_id, source_created_by_user_id,
    source_related_learning_space_id,
    created_at, created_by, updated_at, updated_by,
    participants:class_schedule_participants(
      id, org_id, role, status, display_name, avatar_url, theme_key
    ),
    recurrence:class_schedule_recurrence(
      id, org_id, frequency, interval, count, until, timezone, byday,
      exceptions:class_schedule_recurrence_exceptions(id, occurrence_key, reason),
      overrides:class_schedule_recurrence_overrides(id, occurrence_key, patch)
    )
  `;

  // Step 2: Fetch schedules — use learning_space_id when available, channel_id otherwise
  let query = supabase
    .from('class_schedules')
    .select(selectFragment)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (spaceLink?.learning_space_id) {
    query = query.eq('source_learning_space_id', spaceLink.learning_space_id);
  } else {
    // Fallback: match by source_channel_id directly (mirrors web filter)
    query = query.eq('source_channel_id', channelId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapClassScheduleRow(row as Record<string, unknown>));
}
