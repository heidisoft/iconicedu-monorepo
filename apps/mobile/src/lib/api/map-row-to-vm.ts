import type { MessageVM, UserProfileVM } from '@iconicedu/shared-types';

// Raw shape returned by Supabase when selecting * from messages + sender join.
// The `content` JSONB column stores the type-specific payload inline
// (text messages store { text }, rich types store their full payload object).
export type RawMessageRow = {
  id: string;
  org_id: string;
  channel_id: string;
  sender_profile_id: string;
  type: string;
  content: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  sender: {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    avatar_seed: string | null;
  };
};

function buildSenderProfile(
  sender: RawMessageRow['sender'],
  orgId: string,
): UserProfileVM {
  const displayName =
    sender.display_name ??
    [sender.first_name, sender.last_name].filter(Boolean).join(' ') ||
    'Unknown';

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

export function mapRowToMessageVM(row: RawMessageRow): MessageVM {
  const c = row.content ?? {};
  const sender = buildSenderProfile(row.sender, row.org_id);
  const previewText = String(c.text ?? '');

  const base = {
    ids: { id: row.id, orgId: row.org_id },
    core: {
      type: row.type,
      sender,
      createdAt: row.created_at,
      visibility: { type: 'all' as const },
    },
    social: { reactions: [] },
  };

  // Each rich type stores its full payload object inside the content JSONB column.
  // For text messages the mobile inserts `content: { text }` directly.
  // For web-created rich messages, content holds the nested payload key.
  switch (row.type) {
    case 'text':
      return { ...base, content: { text: previewText } } as MessageVM;

    case 'lesson-assignment':
      return {
        ...base,
        content: { text: previewText },
        assignment: c.assignment ?? c,
      } as MessageVM;

    case 'homework-submission':
      return {
        ...base,
        content: { text: previewText },
        homework: c.homework ?? c,
      } as MessageVM;

    case 'progress-update':
      return {
        ...base,
        content: { text: previewText },
        progress: c.progress ?? c,
      } as MessageVM;

    case 'event-reminder':
      return {
        ...base,
        content: { text: previewText },
        event: c.event ?? c,
      } as MessageVM;

    case 'session-summary':
      return {
        ...base,
        content: { text: previewText },
        session: c.session ?? c,
      } as MessageVM;

    case 'session-complete':
      return {
        ...base,
        content: { text: previewText },
        session: c.session ?? c,
      } as MessageVM;

    case 'session-booking':
      return {
        ...base,
        content: { text: previewText },
        booking: c.booking ?? c,
      } as MessageVM;

    case 'payment-reminder':
      return {
        ...base,
        content: { text: previewText },
        payment: c.payment ?? c,
      } as MessageVM;

    case 'feedback-request':
      return {
        ...base,
        content: { text: previewText },
        feedback: c.feedback ?? c,
      } as MessageVM;

    case 'image':
      return {
        ...base,
        content: { text: previewText },
        attachment: c.attachment ?? c,
      } as MessageVM;

    case 'file':
      return {
        ...base,
        content: { text: previewText },
        attachment: c.attachment ?? c,
      } as MessageVM;

    case 'audio-recording':
      return { ...base, audio: c.audio ?? c } as MessageVM;

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
