import { supabase } from '@/lib/supabase/client';
import { File as ExpoFile } from 'expo-file-system';
import type {
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
  ThemeKey,
  ActivityFeedVM,
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedSectionVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
  ActivityVerbVM,
  ActivityItemContentVM,
  ActivityItemAudienceVM,
  ActivityItemRefsVM,
  ActivityItemStateVM,
  ActivityItemGroupingVM,
  ActivityFeedItemRow,
  ActivityFeedGroupMemberRow,
} from '@iconicedu/shared-types';
import {
  mapRowToMessageVM,
  buildSenderProfile,
  type RawMessageRow,
  type RawSenderProfile,
} from './map-row-to-vm';

export const queryKeys = {
  profile: (profileId: string) => ['profile', profileId] as const,
  channels: (orgId: string) => ['channels', orgId] as const,
  directMessages: (orgId: string, profileId: string) =>
    ['directMessages', orgId, profileId] as const,
  channel: (channelId: string) => ['channel', channelId] as const,
  messages: (channelId: string) => ['messages', channelId] as const,
  learningSpaces: (orgId: string) => ['learningSpaces', orgId] as const,
  learningSpace: (spaceId: string) => ['learningSpace', spaceId] as const,
  inbox: (orgId: string, profileId: string) => ['inbox', orgId, profileId] as const,
  sidebar: (orgId: string, profileId: string) => ['sidebar', orgId, profileId] as const,
  notificationPrefs: (orgId: string, profileId: string) =>
    ['notificationPrefs', orgId, profileId] as const,
  familyLinks: (orgId: string, accountId: string) =>
    ['familyLinks', orgId, accountId] as const,
  childProfiles: (orgId: string, accountIds: string[]) =>
    ['childProfiles', orgId, accountIds] as const,
  spaceSchedules: (channelId: string, orgId: string) =>
    ['space-sessions', channelId, orgId] as const,
  orgSessions: (orgId: string) => ['org-sessions', orgId] as const,
  supervisedDirectMessages: (orgId: string, accountId: string) =>
    ['supervisedDirectMessages', orgId, accountId] as const,
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
    .select(
      '*, profile:profiles!account_id(id, display_name, first_name, last_name, avatar_seed)',
    )
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
  /** Class subject emoji, e.g. "📐". */
  icon_emoji?: string | null;
  /** Primary student name this space is for. */
  student_name?: string | null;
  /** DM channel participants (other people, self excluded). */
  participants?: DmParticipant[];
  /** True when guardian is viewing a child's DM they do not participate in. */
  is_supervised?: boolean;
  /** Display name of the child whose conversation this is. */
  supervised_child_name?: string | null;
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
    .select(
      'channel_id, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed)',
    )
    .in(
      'channel_id',
      chRows.map((c) => c.id),
    )
    .is('deleted_at', null);

  // Build channelId → DmParticipant[] map, excluding self
  const participantMap = new Map<string, DmParticipant[]>();
  for (const member of memberRows ?? []) {
    const profile = member.profile as unknown as DmParticipant | null;
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

export async function fetchSupervisedDirectMessages(
  orgId: string,
  guardianAccountId: string,
  guardianProfileId: string,
): Promise<ChannelListItem[]> {
  if (!orgId || !guardianAccountId || !guardianProfileId) return [];

  // Step 1: get child account IDs from family_links
  const { data: links } = await supabase
    .from('family_links')
    .select('child_account_id')
    .eq('guardian_account_id', guardianAccountId)
    .eq('org_id', orgId)
    .is('deleted_at', null);
  if (!links?.length) return [];

  const childAccountIds = links
    .map((l: { child_account_id: string }) => l.child_account_id)
    .filter(Boolean);

  // Step 2: get child profiles (id + display name for the supervised label)
  const { data: childProfiles } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name, account_id')
    .in('account_id', childAccountIds)
    .is('deleted_at', null);
  if (!childProfiles?.length) return [];

  // Step 3: get all channel IDs the guardian is already a member of (to exclude)
  const { data: guardianMemberships } = await supabase
    .from('channel_members')
    .select('channel_id')
    .eq('profile_id', guardianProfileId)
    .eq('org_id', orgId)
    .is('deleted_at', null);
  const guardianChannelIds = new Set(
    (guardianMemberships ?? []).map((m: { channel_id: string }) => m.channel_id),
  );

  // Step 4: for each child, fetch DM channels where child is member but guardian is not
  const results: ChannelListItem[] = [];

  for (const child of childProfiles as Array<{
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    account_id: string;
  }>) {
    const childName =
      child.display_name?.trim() ||
      [child.first_name, child.last_name].filter(Boolean).join(' ').trim() ||
      'Child';

    const { data: childMemberships } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('profile_id', child.id)
      .eq('org_id', orgId)
      .is('deleted_at', null);

    const childOnlyChannelIds = (childMemberships ?? [])
      .map((m: { channel_id: string }) => m.channel_id)
      .filter((id: string) => !guardianChannelIds.has(id));
    if (!childOnlyChannelIds.length) continue;

    const { data: chRows } = await supabase
      .from('channels')
      .select('id, org_id, topic, description, kind, updated_at')
      .in('id', childOnlyChannelIds)
      .eq('org_id', orgId)
      .eq('kind', 'dm')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (!chRows?.length) continue;

    // Fetch participants for display (exclude the child — show the other party)
    const { data: memberRows } = await supabase
      .from('channel_members')
      .select(
        'channel_id, profile_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed)',
      )
      .in(
        'channel_id',
        chRows.map((c: { id: string }) => c.id),
      )
      .is('deleted_at', null);

    const participantsMap = new Map<string, DmParticipant[]>();
    for (const m of memberRows ?? []) {
      const row = m as {
        channel_id: string;
        profile_id: string;
        profile: DmParticipant | null;
      };
      if (row.profile_id === child.id) continue;
      const p = row.profile;
      if (!p) continue;
      const list = participantsMap.get(row.channel_id) ?? [];
      list.push(p);
      participantsMap.set(row.channel_id, list);
    }

    for (const ch of chRows as Array<{
      id: string;
      org_id: string;
      topic: string | null;
      description: string | null;
      kind: string;
      updated_at: string;
    }>) {
      results.push({
        id: ch.id,
        org_id: ch.org_id,
        topic: ch.topic ?? null,
        description: ch.description ?? null,
        kind: ch.kind,
        updated_at: ch.updated_at,
        unread_count: 0,
        last_message_text: null,
        last_message_at: null,
        last_message_sender: null,
        participants: participantsMap.get(ch.id) ?? [],
        is_supervised: true,
        supervised_child_name: childName,
      });
    }
  }

  // Deduplicate by channel id (a channel could theoretically have multiple children)
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

// ─── Shared preview helper ────────────────────────────────────────────────────

type LastMessageInfo = { text: string | null; at: string | null; sender: string | null };

const PREVIEW_LABELS: Record<string, string> = {
  image: '🖼 Image',
  file: '📎 File',
  'audio-recording': '🎙 Voice message',
  'lesson-assignment': '📚 Assignment',
  'homework-submission': '📝 Homework submitted',
  'progress-update': '📈 Progress update',
  'event-reminder': '📅 Event reminder',
  'session-summary': '📋 Session summary',
  'session-complete': '✓ Session complete',
  'session-booking': '🗓 Session booked',
  'payment-reminder': '💳 Payment reminder',
  'feedback-request': '💬 Feedback request',
};

/**
 * Batch-fetch the most recent message preview for a list of channel IDs.
 * Two queries: one for the latest message row per channel, one for text payloads.
 */
async function fetchLastMessages(
  channelIds: string[],
): Promise<Map<string, LastMessageInfo>> {
  if (!channelIds.length) return new Map();

  type MsgRow = {
    id: string;
    channel_id: string;
    type: string;
    created_at: string;
    sender: {
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };

  // Fetch recent top-level messages (no thread replies), ordered newest-first.
  // Limit heuristic: 3 per channel gives enough headroom to find the latest per channel in JS.
  const { data: msgRows } = await supabase
    .from('messages')
    .select(
      'id, channel_id, type, created_at, sender:profiles!sender_profile_id(display_name, first_name, last_name)',
    )
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .is('thread_parent_id', null)
    .order('created_at', { ascending: false })
    .limit(channelIds.length * 3);

  if (!msgRows?.length) return new Map();

  const rows = msgRows as unknown as MsgRow[];

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
      const text = (
        (t.payload as Record<string, unknown>)?.text as string | undefined
      )?.trim();
      if (text) textByMessageId.set(t.message_id, text);
    }
  }

  const result = new Map<string, LastMessageInfo>();
  for (const [channelId, row] of latestByChannel) {
    const text =
      row.type === 'text'
        ? (textByMessageId.get(row.id) ?? null)
        : (PREVIEW_LABELS[row.type] ?? null);
    const s = row.sender;
    const sender = s
      ? s.display_name?.trim() ||
        [s.first_name, s.last_name].filter(Boolean).join(' ') ||
        null
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
    const readState = (
      ch.channel_read_state as Array<{ unread_count: number | null }> | null
    )?.[0];
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
  for (const r of (reactionRows ?? []) as Array<{
    message_id: string;
    emoji: string;
    account_id: string;
  }>) {
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
async function loadThreads(parentMessageIds: string[]): Promise<Map<string, ThreadVM>> {
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
  if (!threadRows || threadRows.length === 0) return new Map();

  const typedThreadRows = threadRows as RawThreadRow[];
  const threadIds = typedThreadRows.map((t) => t.id);

  const { data: participantRows, error: participantError } = await supabase
    .from('thread_participants')
    .select(
      'thread_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed)',
    )
    .in('thread_id', threadIds)
    .is('deleted_at', null);

  if (participantError) {
    console.warn('[loadThreads] participants query failed:', participantError.message);
  }

  // Build thread_id → participants map
  const participantsByThread = new Map<string, RawSenderProfile[]>();
  for (const p of (participantRows ?? []) as unknown as RawThreadParticipantRow[]) {
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
        lastReplyAt: t.last_reply_at ?? t.created_at, // fallback = thread created_at
      },
      participants,
    });
  }

  return result;
}

export async function fetchChannelMessages(
  channelId: string,
  _currentProfileId = '',
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

  const typedRows = rows as unknown as RawMessageRow[];
  const messageIds = typedRows.map((r) => r.id);

  const [payloadMap, reactionMap, threadsMap] = await Promise.all([
    loadPayloads(typedRows),
    loadReactions(messageIds, currentAccountId),
    loadThreads(messageIds),
  ]);

  // Reverse a copy (oldest→newest) without mutating the typed rows array.
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
  _currentProfileId = '',
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

  const typedRows = rows as unknown as RawMessageRow[];
  const messageIds = typedRows.map((r) => r.id);

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

/** Emoji icon for each class icon_key (Lucide icon keys mapped to emoji equivalents). */
const SPACE_ICON_EMOJI: Record<string, string> = {
  'square-pi': '📐',
  languages: '🌐',
  'chef-hat': '👨‍🍳',
  earth: '🌍',
  sparkles: '✨',
  'book-open': '📖',
  'flask-conical': '🧪',
  music: '🎵',
  palette: '🎨',
  dumbbell: '🏋️',
};

/**
 * Fetches class primary channels for the messages tab, scoped to
 * spaces the logged-in user participates in.
 * Mirrors web's learning_space_participants filtering pattern.
 */
export async function fetchLearningSpaceChannels(
  orgId: string,
  myProfileId: string,
): Promise<ChannelListItem[]> {
  if (!myProfileId) return [];

  // Step 1: get class IDs where the user is a participant
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

  // Step 2: fetch primary channels for those classes
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
  const toSpace = (r: Row) =>
    r.space as unknown as {
      id: string;
      title: string;
      icon_key: string | null;
      subject: string | null;
      status: string;
      deleted_at: string | null;
    } | null;
  const toChannel = (r: Row) =>
    r.channel as unknown as { id: string; org_id: string; updated_at: string } | null;

  const items = (data ?? [])
    .filter((row) => {
      const sp = toSpace(row);
      const ch = toChannel(row);
      return (
        sp && ch && !sp.deleted_at && (sp.status === 'active' || sp.status === 'paused')
      );
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
    .select(
      'id, account_id, display_name, first_name, last_name, avatar_url, avatar_seed, kind',
    )
    .eq('org_id', orgId)
    .in('account_id', accountIds)
    .is('deleted_at', null);
  if (error) throw error;
  return data ?? [];
}

const MOBILE_ALLOWED_ROLES = new Set([
  'educator',
  'guardian',
  'child',
  'staff',
  'admin',
  'system',
]);

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
      () =>
        reject(
          new Error(
            'Account lookup timed out. Please check your connection and try again.',
          ),
        ),
      12_000,
    ),
  );
  return Promise.race([_doFetchOnboardingStatus(), timeout]);
}

async function _doFetchOnboardingStatus(): Promise<OnboardingStatus> {
  // getSession() reads from SecureStore — no network request, no hang risk.
  // getUser() verifies with the auth server over the network and can hang indefinitely.
  const {
    data: { session },
  } = await supabase.auth.getSession();
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

  if (!account)
    throw new Error('No account found for this user. Please contact your administrator.');

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
    .select(
      'id, kind, first_name, last_name, timezone, city, region, postal_code, country_code',
    )
    .eq('account_id', account.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (profileError) console.warn('[onboarding] profile fetch error:', profileError);
  if (profile) {
    profileId = profile.id;
    profileKind = profile.kind ?? null;
    firstName = profile.first_name ?? '';
    lastName = profile.last_name ?? '';
    timezone = profile.timezone ?? '';
    city = ((profile as Record<string, unknown>).city as string) ?? '';
    region = ((profile as Record<string, unknown>).region as string) ?? '';
    postalCode = ((profile as Record<string, unknown>).postal_code as string) ?? '';
    countryCode = ((profile as Record<string, unknown>).country_code as string) ?? '';
  }

  const kind = profileKind ?? account.primary_role ?? null;

  // Mirror web's determineOnboardingStep required-field checks:
  const hasName = !!firstName.trim() && !!lastName.trim();
  const hasTimezone = !!timezone.trim() && timezone.trim() !== 'UTC';
  const hasLocation = !!city.trim() && !!region.trim();
  const requiresPhone = kind !== 'child';
  const hasPhone = !!account.phone_e164?.trim();

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
      supabase
        .from('educator_profile_subjects')
        .select('subject')
        .eq('profile_id', profileId)
        .limit(1),
      supabase
        .from('educator_profile_grade_levels')
        .select('grade_id')
        .eq('profile_id', profileId)
        .limit(1),
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
    flags: {
      hasName,
      hasTimezone,
      hasLocation,
      hasPhone,
      requiresPhone,
      hasRoleData,
      hasAvailability,
    },
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

export async function saveNameStep(
  profileId: string,
  firstName: string,
  lastName: string,
) {
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: displayName,
    })
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
    .upsert(
      { profile_id: profileId, org_id: orgId, birth_year: birthYear },
      { onConflict: 'profile_id' },
    );
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
    const subjectRows = subjects.map((subject) => ({
      profile_id: profileId,
      org_id: orgId,
      subject,
    }));
    const { error } = await supabase
      .from('educator_profile_subjects')
      .insert(subjectRows);
    if (error) throw error;
  }

  // Save grade levels
  await supabase
    .from('educator_profile_grade_levels')
    .delete()
    .eq('profile_id', profileId);
  if (gradeLevels.length > 0) {
    const gradeRows = gradeLevels.map((grade_id) => ({
      profile_id: profileId,
      org_id: orgId,
      grade_id,
    }));
    const { error } = await supabase
      .from('educator_profile_grade_levels')
      .insert(gradeRows);
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
  const { error } = await supabase.from('educator_availabilities').upsert(
    {
      profile_id: profileId,
      org_id: orgId,
      class_types: classTypes,
      weekly_commitment: weeklyCommitment,
      availability,
    },
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
  threadId?: string, // threads.id — set when replying to existing thread
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
          .select(
            'sender_profile_id, sender:profiles!sender_profile_id(display_name, first_name, last_name)',
          )
          .eq('id', threadParentId)
          .maybeSingle(),
        supabase
          .from('message_text')
          .select('payload')
          .eq('message_id', threadParentId)
          .maybeSingle(),
      ]);

      type ParentSenderShape = {
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
      };
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
        (
          (parentText?.payload as Record<string, unknown> | null)?.text as
            | string
            | undefined
        )?.slice(0, 100) ?? text.slice(0, 100);

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
        new Set([
          senderProfileId,
          ...(parentSenderProfileId ? [parentSenderProfileId] : []),
        ]),
      );
      await supabase.from('thread_participants').upsert(
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
  const { error: textError } = await supabase.from('message_text').insert({
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
  const baseName = sanitizeStorageFileName(name.replace(/\.[^/.]+$/, '')).replace(
    /\.+$/g,
    '',
  );
  return ext
    ? `${timestamp}-${randomSuffix}-${baseName}.${ext}`
    : `${timestamp}-${randomSuffix}-${baseName}`;
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
  const binaryStr = globalThis.atob(base64);
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
          byWeekday:
            (recurrenceRow.byday as
              | string[]
              | null as RecurrenceVM['rule']['byWeekday']) ?? undefined,
          count: (recurrenceRow.count as number | null) ?? undefined,
          until: (recurrenceRow.until as string | null) ?? undefined,
          timezone: (recurrenceRow.timezone as string | null) ?? undefined,
        },
        exceptions: ((recurrenceRow.exceptions as Record<string, unknown>[]) ?? []).map(
          (e) => ({
            occurrenceKey: e.occurrence_key as string,
            reason: (e.reason as string | null) ?? undefined,
          }),
        ),
        overrides: ((recurrenceRow.overrides as Record<string, unknown>[]) ?? []).map(
          (o) => ({
            occurrenceKey: o.occurrence_key as string,
            patch: o.patch as ClassSchedulePatchVM,
          }),
        ),
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
    source = {
      kind: 'availability_block',
      ownerUserId: row.source_owner_user_id as string,
    };
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
    themeKey: (p.theme_key as ThemeKey | null) ?? undefined,
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
    themeKey: (row.theme_key as ThemeKey | null) ?? undefined,
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

const CLASS_SCHEDULE_SELECT = `
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

/**
 * Fetches class schedules for a channel.
 * Mirrors the web: filters server-side by source_kind='class_session' and
 * source_channel_id=channelId — no learning_space_channels lookup needed.
 */
export async function fetchSpaceSchedulesByChannelId(
  channelId: string,
  orgId: string,
): Promise<ClassScheduleVM[]> {
  const { data, error } = await supabase
    .from('class_schedules')
    .select(CLASS_SCHEDULE_SELECT)
    .eq('org_id', orgId)
    .eq('source_kind', 'class_session')
    .eq('source_channel_id', channelId)
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapClassScheduleRow(row as Record<string, unknown>));
}

/**
 * Fetches all class schedules for an org (across all channels).
 * Used for the home screen "Upcoming sessions" section.
 * Recurring expansion is done client-side.
 */
export async function fetchOrgSessions(orgId: string): Promise<ClassScheduleVM[]> {
  const { data, error } = await supabase
    .from('class_schedules')
    .select(CLASS_SCHEDULE_SELECT)
    .eq('org_id', orgId)
    .eq('source_kind', 'class_session')
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapClassScheduleRow(row as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

const ACTIVITY_FEED_ITEM_SELECT = [
  'id',
  'org_id',
  'recipient_profile_id',
  'source_event_id',
  'kind',
  'occurred_at',
  'created_at',
  'tab_key',
  'audience',
  'verb',
  'actor_profile_id',
  'refs',
  'group_key',
  'group_type',
  'is_collapsed',
  'sub_activity_count',
  'content',
  'summary',
  'preview',
  'action_button',
  'expanded_content',
  'importance',
  'is_read',
  'read_at',
  'dedupe_key',
  'metadata',
  'updated_at',
  'deleted_at',
].join(',');

const ACTIVITY_FEED_GROUP_MEMBER_SELECT =
  'id,org_id,group_id,item_id,updated_at,deleted_at';

const FEED_TABS: Array<{ key: InboxTabKeyVM; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'classes', label: 'Classes' },
  { key: 'payment', label: 'Payment' },
  { key: 'system', label: 'System' },
];

function mapFeedRow(row: ActivityFeedItemRow): ActivityFeedItemVM {
  const contentBase = (row.content ?? {}) as Partial<ActivityItemContentVM>;
  const content: ActivityItemContentVM = {
    ...contentBase,
    headline: contentBase.headline ?? { primary: row.summary ?? 'Activity update' },
    summary: contentBase.summary ?? row.summary ?? undefined,
    preview:
      contentBase.preview ??
      (row.preview as ActivityItemContentVM['preview']) ??
      undefined,
    actionButton:
      contentBase.actionButton ??
      (row.action_button as ActivityItemContentVM['actionButton']) ??
      undefined,
    expandedContent: contentBase.expandedContent ?? row.expanded_content ?? undefined,
  };

  const refsBase = (row.refs ?? {}) as Partial<ActivityItemRefsVM>;
  const refs = { ...refsBase } as ActivityItemRefsVM;

  const audienceBase = (row.audience ?? {}) as Partial<ActivityItemAudienceVM>;
  const audience: ActivityItemAudienceVM = {
    ...audienceBase,
    scope: audienceBase.scope ?? { kind: 'global' },
    visibility: audienceBase.visibility ?? 'public',
  };

  const grouping: ActivityItemGroupingVM | undefined =
    row.group_key || row.group_type
      ? {
          groupKey: row.group_key ?? undefined,
          groupType: row.group_type as ActivityItemGroupingVM['groupType'],
        }
      : undefined;

  const state: ActivityItemStateVM = {
    importance: row.importance as ActivityItemStateVM['importance'],
    isRead: row.is_read ?? undefined,
  };

  return {
    kind: (row.kind ?? 'leaf') as ActivityFeedItemVM['kind'],
    ids: { id: row.id, orgId: row.org_id },
    timestamps: {
      occurredAt: row.occurred_at ?? row.created_at,
      createdAt: row.created_at,
    },
    tabKey: row.tab_key as InboxTabKeyVM,
    audience,
    verb: row.verb as ActivityVerbVM,
    refs,
    content,
    state,
    grouping,
    subActivityCount: row.sub_activity_count ?? undefined,
    isCollapsed: row.is_collapsed ?? undefined,
  } as ActivityFeedItemVM;
}

function attachFeedGroupMembers(
  items: ActivityFeedItemVM[],
  groupMembers: ActivityFeedGroupMemberRow[],
): ActivityFeedItemVM[] {
  if (!groupMembers.length) return items;

  const itemMap = new Map(items.map((item) => [item.ids.id, item]));
  const membersByGroup = new Map<string, string[]>();
  groupMembers.forEach((member) => {
    const list = membersByGroup.get(member.group_id) ?? [];
    list.push(member.item_id);
    membersByGroup.set(member.group_id, list);
  });

  const groupedMemberIds = new Set<string>();
  const withGroups = items.map((item) => {
    if (item.kind !== 'group') return item;

    const memberIds = membersByGroup.get(item.ids.id) ?? [];
    const members = memberIds
      .map((id) => itemMap.get(id))
      .filter((m): m is ActivityFeedLeafItemVM => m !== undefined && m.kind === 'leaf');

    memberIds.forEach((id) => groupedMemberIds.add(id));

    return {
      ...item,
      subActivities: { items: members },
      subActivityCount: item.subActivityCount ?? members.length,
    } as ActivityFeedItemVM;
  });

  return withGroups.filter(
    (item) => item.kind === 'group' || !groupedMemberIds.has(item.ids.id),
  );
}

function buildFeedSections(items: ActivityFeedItemVM[]): ActivityFeedSectionVM[] {
  if (!items.length) return [];

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const today: ActivityFeedItemVM[] = [];
  const thisWeek: ActivityFeedItemVM[] = [];
  const older: ActivityFeedItemVM[] = [];

  items.forEach((item) => {
    const occurredAt = new Date(item.timestamps.occurredAt);
    if (occurredAt >= startOfToday) {
      today.push(item);
      return;
    }
    if (occurredAt >= startOfWeek) {
      thisWeek.push(item);
      return;
    }
    older.push(item);
  });

  const sections: ActivityFeedSectionVM[] = [];
  if (today.length) sections.push({ label: 'Today', items: today });
  if (thisWeek.length) sections.push({ label: 'This week', items: thisWeek });
  if (older.length) sections.push({ label: 'Earlier', items: older });
  return sections;
}

function buildFeedTabs(items: ActivityFeedItemVM[]): ActivityFeedTabVM[] {
  const counts = new Map<InboxTabKeyVM, number>();
  items.forEach((item) => {
    const unread =
      item.kind === 'group'
        ? ((
            item as { subActivities?: { items: ActivityFeedLeafItemVM[] } }
          ).subActivities?.items.filter((sub) => !sub.state?.isRead).length ??
          (!item.state?.isRead ? 1 : 0))
        : !item.state?.isRead
          ? 1
          : 0;
    if (!unread) return;
    counts.set(item.tabKey, (counts.get(item.tabKey) ?? 0) + unread);
  });

  return FEED_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    badgeCount:
      tab.key === 'all'
        ? Array.from(counts.values()).reduce((t, n) => t + n, 0)
        : (counts.get(tab.key) ?? 0),
  }));
}

export async function fetchActivityFeed(
  orgId: string,
  profileId: string,
): Promise<ActivityFeedVM> {
  const { data: itemRows, error: itemsError } = await supabase
    .from('activity_feed_items')
    .select(ACTIVITY_FEED_ITEM_SELECT)
    .eq('org_id', orgId)
    .eq('recipient_profile_id', profileId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .returns<ActivityFeedItemRow[]>();

  if (itemsError) throw itemsError;
  const rows = itemRows ?? [];

  const groupIds = rows.filter((r) => r.kind === 'group').map((r) => r.id);
  let groupMembers: ActivityFeedGroupMemberRow[] = [];
  if (groupIds.length) {
    const { data: members, error: membersError } = await supabase
      .from('activity_feed_group_members')
      .select(ACTIVITY_FEED_GROUP_MEMBER_SELECT)
      .eq('org_id', orgId)
      .in('group_id', groupIds)
      .is('deleted_at', null)
      .returns<ActivityFeedGroupMemberRow[]>();
    if (membersError) throw membersError;
    groupMembers = members ?? [];
  }

  const mappedItems = rows.map(mapFeedRow);
  const groupedItems = attachFeedGroupMembers(mappedItems, groupMembers);
  const sections = buildFeedSections(groupedItems);
  const tabs = buildFeedTabs(mappedItems);
  const unreadCount = mappedItems.filter((item) => !item.state?.isRead).length;

  return {
    activeTab: 'all',
    tabs,
    sections,
    nextCursor: null,
    unreadCount,
  };
}

export async function markActivityFeedRead(
  orgId: string,
  profileId: string,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;

  // Expand any group IDs to include their child member IDs
  const { data: members } = await supabase
    .from('activity_feed_group_members')
    .select('item_id')
    .eq('org_id', orgId)
    .in('group_id', ids);

  const childIds = (members ?? []).map((m) => m.item_id as string);
  const allIds = [...new Set([...ids, ...childIds])];

  await supabase
    .from('activity_feed_items')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: profileId,
    })
    .eq('org_id', orgId)
    .eq('recipient_profile_id', profileId)
    .in('id', allIds);
}
