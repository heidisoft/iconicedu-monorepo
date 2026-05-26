import type {
  MessageVM,
  ReactionVM,
  ThreadVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

export type RawMessageRow = {
  id: string;
  org_id: string;
  channel_id: string;
  sender_profile_id: string;
  visibility_type?: 'all' | 'specific-users' | null;
  visibility_user_ids?: string[] | null;
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
    kind?: string | null;
    timezone?: string | null;
    ui_theme_key?: string | null;
  } | null;
};

export type RawSenderProfile = NonNullable<RawMessageRow['sender']>;

export function buildSenderProfile(
  sender: RawSenderProfile,
  orgId: string,
): UserProfileVM {
  const displayName =
    sender.display_name ??
    ([sender.first_name, sender.last_name].filter(Boolean).join(' ') || 'Unknown');

  return {
    ids: { id: sender.id, orgId, accountId: '' },
    kind: (sender.kind as UserProfileVM['kind'] | null) ?? 'educator',
    profile: {
      displayName,
      avatar: sender.avatar_url
        ? { source: 'url' as const, url: sender.avatar_url }
        : { source: 'seed' as const, seed: sender.avatar_seed ?? sender.id },
    },
    prefs: { timezone: sender.timezone ?? null },
    ui: { themeKey: sender.ui_theme_key ?? null },
    meta: { createdAt: '', updatedAt: '' },
  } as unknown as UserProfileVM;
}

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

export function mapRowToMessageVM(
  row: RawMessageRow,
  payload: Record<string, unknown> | null,
  reactions: ReactionVM[],
  thread?: ThreadVM,
): MessageVM {
  const c = payload ?? {};
  const sender = buildSenderProfile(
    row.sender ?? {
      id: row.sender_profile_id,
      display_name: 'Unknown',
      first_name: null,
      last_name: null,
      avatar_url: null,
      avatar_seed: row.sender_profile_id,
      kind: null,
      timezone: null,
      ui_theme_key: null,
    },
    row.org_id,
  );
  const previewText = String(c.text ?? '');

  const base = {
    ids: { id: row.id, orgId: row.org_id },
    core: {
      type: row.type,
      sender,
      createdAt: row.created_at,
      visibility:
        row.visibility_type === 'specific-users'
          ? {
              type: 'specific-users' as const,
              userIds: row.visibility_user_ids ?? [],
            }
          : { type: 'all' as const },
    },
    social: { reactions, ...(thread ? { thread } : {}) },
  };

  switch (row.type) {
    case 'text':
      return { ...base, content: { text: previewText } } as MessageVM;
    case 'lesson-assignment':
      return { ...base, content: { text: previewText }, assignment: c } as MessageVM;
    case 'homework-submission':
      return { ...base, content: { text: previewText }, homework: c } as MessageVM;
    case 'progress-update':
      return { ...base, content: { text: previewText }, progress: c } as MessageVM;
    case 'event-reminder':
      return { ...base, content: { text: previewText }, event: c } as MessageVM;
    case 'session-summary':
    case 'session-complete':
      return { ...base, content: { text: previewText }, session: c } as MessageVM;
    case 'session-booking':
      return { ...base, content: { text: previewText }, booking: c } as MessageVM;
    case 'payment-reminder':
      return { ...base, content: { text: previewText }, payment: c } as MessageVM;
    case 'feedback-request':
      return { ...base, content: { text: previewText }, feedback: c } as MessageVM;
    case 'image': {
      const attachments =
        Array.isArray(c.attachments) && c.attachments.length > 0
          ? (c.attachments as Record<string, unknown>[])
          : [c];
      return {
        ...base,
        content: previewText ? { text: previewText } : undefined,
        attachment: attachments[0],
        attachments,
      } as MessageVM;
    }
    case 'file': {
      const attachments =
        Array.isArray(c.attachments) && c.attachments.length > 0
          ? (c.attachments as Record<string, unknown>[])
          : [c];
      return {
        ...base,
        content: previewText ? { text: previewText } : undefined,
        attachment: attachments[0],
        attachments,
      } as MessageVM;
    }
    case 'link-preview':
      return {
        ...base,
        content: c.text ? { text: String(c.text) } : undefined,
        link: {
          url: String(c.url ?? ''),
          title: String(c.title ?? ''),
          description: typeof c.description === 'string' ? c.description : undefined,
          imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
          siteName: typeof c.siteName === 'string' ? c.siteName : undefined,
          favicon: typeof c.favicon === 'string' ? c.favicon : undefined,
        },
      } as MessageVM;
    case 'audio-recording':
      return {
        ...base,
        content: previewText ? { text: previewText } : undefined,
        audio: c,
      } as MessageVM;
    default:
      return { ...base, content: { text: previewText } } as MessageVM;
  }
}
