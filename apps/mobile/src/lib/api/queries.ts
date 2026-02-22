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

export async function fetchDirectMessages(orgId: string, profileId: string) {
  const { data, error } = await supabase
    .from('channels')
    .select(
      `
      *,
      channel_participants!inner(profile_id),
      messages(id, content, created_at, sender_profile_id)
    `,
    )
    .eq('org_id', orgId)
    .eq('kind', 'dm')
    .eq('channel_participants.profile_id', profileId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchChannels(orgId: string) {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('org_id', orgId)
    .eq('kind', 'channel')
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchChannelMessages(
  channelId: string,
  limit = 40,
  before?: string,
) {
  let query = supabase
    .from('messages')
    .select(
      `
      *,
      sender:profiles!sender_profile_id(id, display_name, first_name, last_name, avatar_url, avatar_seed)
    `,
    )
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reverse();
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
