import type { MessageVM, UserProfileVM, ReactionVM, ThreadVM } from '@iconicedu/shared-types';

// Raw shape returned by Supabase when selecting from messages + sender join.
// The messages table has NO `content` column — payloads live in separate
// type-specific tables (message_text, message_image, etc.) with a `payload` jsonb column.
export type RawMessageRow = {
  id: string;
  org_id: string;
  channel_id: string;
  sender_profile_id: string;
  type: string;
  created_at: string;
  updated_at: string;
  thread_parent_id?: string | null;
  sender: {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    avatar_seed: string | null;
  };
};

export type RawSenderProfile = RawMessageRow['sender'];

export type ThreadStats = {
  messageCount: number;
  lastReplyAt: string;
  participants: RawSenderProfile[];
};

export function buildSenderProfile(
  sender: RawSenderProfile,
  orgId: string,
): UserProfileVM {
  const displayName =
    sender.display_name ??
    ([sender.first_name, sender.last_name].filter(Boolean).join(' ') || 'Unknown');

  return {
    ids: { id: sender.id, orgId, accountId: '' },
    kind: 'educator',
    profile: {
      displayName,
      avatar: sender.avatar_url
        ? { source: 'url' as const, url: sender.avatar_url }
        : { source: 'seed' as const, seed: sender.avatar_seed ?? sender.id },
    },
    prefs: {},
    meta: { createdAt: '', updatedAt: '' },
  } as unknown as UserProfileVM;
}

/**
 * Map a raw messages row + its payload (from the type-specific table) + reactions
 * into a MessageVM. Callers are responsible for fetching and passing the payload
 * and reactions separately (multi-step query pattern mirrors apps/web/lib/messages/).
 * Pass threadStats for top-level messages to populate social.thread.
 */
export function mapRowToMessageVM(
  row: RawMessageRow,
  payload: Record<string, unknown> | null,
  reactions: ReactionVM[],
  threadStats?: ThreadStats,
): MessageVM {
  const c = payload ?? {};
  const sender = buildSenderProfile(row.sender, row.org_id);
  const previewText = String(c.text ?? '');

  const thread: ThreadVM | undefined = threadStats
    ? {
        ids: { id: row.id, orgId: row.org_id },
        parent: { messageId: row.id },
        stats: {
          messageCount: threadStats.messageCount,
          lastReplyAt: threadStats.lastReplyAt,
        },
        participants: threadStats.participants.map((p) =>
          buildSenderProfile(p, row.org_id),
        ),
      }
    : undefined;

  const base = {
    ids: { id: row.id, orgId: row.org_id },
    core: {
      type: row.type,
      sender,
      createdAt: row.created_at,
      visibility: { type: 'all' as const },
    },
    social: { reactions, ...(thread ? { thread } : {}) },
    ...(row.thread_parent_id ? { threadParentId: row.thread_parent_id } : {}),
  };

  // The payload object IS the full type-specific payload (from message_text.payload etc.)
  switch (row.type) {
    case 'text':
      return { ...base, content: { text: previewText } } as MessageVM;

    case 'lesson-assignment':
      return {
        ...base,
        content: { text: previewText },
        assignment: c,
      } as MessageVM;

    case 'homework-submission':
      return {
        ...base,
        content: { text: previewText },
        homework: c,
      } as MessageVM;

    case 'progress-update':
      return {
        ...base,
        content: { text: previewText },
        progress: c,
      } as MessageVM;

    case 'event-reminder':
      return {
        ...base,
        content: { text: previewText },
        event: c,
      } as MessageVM;

    case 'session-summary':
      return {
        ...base,
        content: { text: previewText },
        session: c,
      } as MessageVM;

    case 'session-complete':
      return {
        ...base,
        content: { text: previewText },
        session: c,
      } as MessageVM;

    case 'session-booking':
      return {
        ...base,
        content: { text: previewText },
        booking: c,
      } as MessageVM;

    case 'payment-reminder':
      return {
        ...base,
        content: { text: previewText },
        payment: c,
      } as MessageVM;

    case 'feedback-request':
      return {
        ...base,
        content: { text: previewText },
        feedback: c,
      } as MessageVM;

    case 'image':
      return {
        ...base,
        content: { text: previewText },
        attachment: c,
      } as MessageVM;

    case 'file':
      return {
        ...base,
        content: { text: previewText },
        attachment: c,
      } as MessageVM;

    case 'audio-recording':
      return { ...base, audio: c } as MessageVM;

    default:
      return { ...base, content: { text: previewText } } as MessageVM;
  }
}

/** Extract a short preview string from a MessageVM for use in list rows. */
export function getMessagePreview(msg: {
  type: string;
  content?: { text?: string } | null;
}): string {
  if (msg.content?.text) return msg.content.text;
  const labels: Record<string, string> = {
    'lesson-assignment':   '📚 Assignment',
    'homework-submission': '📝 Homework submitted',
    'progress-update':     '📈 Progress update',
    'event-reminder':      '📅 Event reminder',
    'session-summary':     '📋 Session summary',
    'session-complete':    '✓ Session complete',
    'session-booking':     '🗓 Session booked',
    'payment-reminder':    '💳 Payment reminder',
    'feedback-request':    '💬 Feedback request',
    image:                 '🖼 Image',
    file:                  '📎 File',
    'audio-recording':     '🎙 Voice message',
  };
  return labels[msg.type] ?? 'Message';
}
