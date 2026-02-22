import { supabase } from '@/lib/supabase/client';
import type {
  UserProfileBlockVM,
  ChannelVM,
  LearningSpaceVM,
  MessageVM,
} from '@iconicedu/shared-types';
import { mapRowToMessageVM, type RawMessageRow } from './map-row-to-vm';

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

export async function fetchUserAccount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: account, error } = await supabase
    .from('accounts')
    .select('*')
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
};

export async function fetchDirectMessages(
  orgId: string,
  profileId: string,
): Promise<ChannelListItem[]> {
  const { data, error } = await supabase
    .from('channels')
    .select(
      `
      id, org_id, topic, description, kind, updated_at,
      channel_participants!inner(profile_id),
      channel_read_state(unread_count),
      last_msg:messages(id, content, created_at, sender:profiles!sender_profile_id(display_name, first_name, last_name))
    `,
    )
    .eq('org_id', orgId)
    .eq('kind', 'dm')
    .eq('channel_participants.profile_id', profileId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((ch) => {
    const msgs = (ch.last_msg ?? []) as Array<{
      id: string;
      content: Record<string, unknown> | null;
      created_at: string;
      sender: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
    }>;
    // last_msg comes unsorted – pick the most recent by created_at
    const last = msgs.reduce<typeof msgs[number] | null>((acc, m) =>
      !acc || m.created_at > acc.created_at ? m : acc, null);

    const readState = (ch.channel_read_state as Array<{ unread_count: number | null }> | null)?.[0];

    return {
      id: ch.id,
      org_id: ch.org_id,
      topic: ch.topic,
      description: ch.description,
      kind: ch.kind,
      updated_at: ch.updated_at,
      unread_count: readState?.unread_count ?? 0,
      last_message_text: last
        ? String(last.content?.text ?? '') || null
        : null,
      last_message_at: last?.created_at ?? null,
      last_message_sender: last?.sender
        ? (last.sender.display_name ??
            ([last.sender.first_name, last.sender.last_name].filter(Boolean).join(' ') || null))
        : null,
    };
  });
}

export async function fetchChannels(orgId: string): Promise<ChannelListItem[]> {
  const { data, error } = await supabase
    .from('channels')
    .select(
      `
      id, org_id, topic, description, kind, updated_at,
      channel_read_state(unread_count),
      last_msg:messages(id, content, created_at, sender:profiles!sender_profile_id(display_name, first_name, last_name))
    `,
    )
    .eq('org_id', orgId)
    .eq('kind', 'channel')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((ch) => {
    const msgs = (ch.last_msg ?? []) as Array<{
      id: string;
      content: Record<string, unknown> | null;
      created_at: string;
      sender: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
    }>;
    const last = msgs.reduce<typeof msgs[number] | null>((acc, m) =>
      !acc || m.created_at > acc.created_at ? m : acc, null);

    const readState = (ch.channel_read_state as Array<{ unread_count: number | null }> | null)?.[0];

    return {
      id: ch.id,
      org_id: ch.org_id,
      topic: ch.topic,
      description: ch.description,
      kind: ch.kind,
      updated_at: ch.updated_at,
      unread_count: readState?.unread_count ?? 0,
      last_message_text: last
        ? String(last.content?.text ?? '') || null
        : null,
      last_message_at: last?.created_at ?? null,
      last_message_sender: last?.sender
        ? (last.sender.display_name ??
            ([last.sender.first_name, last.sender.last_name].filter(Boolean).join(' ') || null))
        : null,
    };
  });
}

const MESSAGE_SELECT = `
  id, org_id, channel_id, sender_profile_id, type, content, created_at, updated_at,
  sender:profiles!sender_profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed)
`;

export async function fetchChannelMessages(
  channelId: string,
  limit = 40,
  before?: string,
): Promise<MessageVM[]> {
  let query = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reverse().map((row) => mapRowToMessageVM(row as RawMessageRow));
}

export async function fetchLearningSpaces(orgId: string) {
  const { data, error } = await supabase
    .from('learning_spaces')
    .select(
      `
      *,
      primary_channel:channels!primary_channel_id(*)
    `,
    )
    .eq('org_id', orgId)
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
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

export async function sendTextMessage(
  channelId: string,
  senderProfileId: string,
  orgId: string,
  text: string,
  threadParentId?: string,
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      sender_profile_id: senderProfileId,
      org_id: orgId,
      type: 'text',
      content: { text },
      thread_parent_id: threadParentId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
