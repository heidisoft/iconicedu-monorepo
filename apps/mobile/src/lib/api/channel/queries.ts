import { apiGet, apiPost } from '@/lib/api/http-client';
import { supabase } from '@/lib/supabase/client';
import type { ChannelListItem } from '@/lib/api/types';

export type DirectMessageChannelOpenResult = {
  channelId: string;
  topic: string;
  avatarSeed: string | null;
  avatarUrl: string | null;
  avatarRole: string | null;
  avatarThemeKey: string | null;
  avatarTimezone: string | null;
  avatarCity: string | null;
  avatarCountryCode: string | null;
  avatarCountryName: string | null;
};

export async function fetchDirectMessages(
  orgId: string,
  myProfileId: string,
  myAccountId: string,
): Promise<ChannelListItem[]> {
  return apiGet('/channels/dms', {
    orgId,
    profileId: myProfileId,
    accountId: myAccountId,
  });
}

export async function fetchSupervisedDirectMessages(
  orgId: string,
  guardianAccountId: string,
  guardianProfileId: string,
): Promise<ChannelListItem[]> {
  return apiGet('/channels/supervised-dms', {
    orgId,
    guardianAccountId,
    guardianProfileId,
  });
}

export async function fetchDirectMessageChannelMetaByChannelId(
  orgId: string,
  profileId: string,
  accountId: string,
  channelId: string,
): Promise<ChannelListItem | null> {
  if (!orgId || !profileId || !accountId || !channelId) return null;
  return apiGet(`/channels/${channelId}/dm-meta`, {
    orgId,
    profileId,
    accountId,
  });
}

export async function findDirectMessageChannelForProfiles(
  orgId: string,
  currentProfileId: string,
  targetProfileId: string,
): Promise<DirectMessageChannelOpenResult | null> {
  if (
    !orgId ||
    !currentProfileId ||
    !targetProfileId ||
    currentProfileId === targetProfileId
  ) {
    return null;
  }
  return apiGet('/channels/find-dm', {
    orgId,
    profileId: currentProfileId,
    otherProfileId: targetProfileId,
  });
}

export async function ensureDirectMessageChannelForProfiles(
  orgId: string,
  currentProfileId: string,
  targetProfileId: string,
): Promise<DirectMessageChannelOpenResult | null> {
  if (
    !orgId ||
    !currentProfileId ||
    !targetProfileId ||
    currentProfileId === targetProfileId
  ) {
    return null;
  }
  return apiPost('/channels/ensure-dm', {
    orgId,
    profileId: currentProfileId,
    otherProfileId: targetProfileId,
  });
}

export async function fetchChannels(
  orgId: string,
  accountId: string,
): Promise<ChannelListItem[]> {
  return apiGet('/channels/list', { orgId, accountId });
}

export async function fetchChannelMetaByChannelId(
  orgId: string,
  accountId: string,
  channelId: string,
): Promise<ChannelListItem | null> {
  if (!orgId || !accountId || !channelId) return null;
  return apiGet(`/channels/${channelId}/meta`, {
    orgId,
    accountId,
  });
}

export async function fetchIsChannelMember(
  orgId: string,
  channelId: string,
  profileId: string,
): Promise<boolean> {
  if (!orgId || !channelId || !profileId) return false;
  const response = await apiGet<{ isMember: boolean }>(
    `/channels/${channelId}/membership`,
    {
      orgId,
      profileId,
    },
  );
  return response.isMember;
}

export type ChannelMemberProfileItem = {
  id: string;
  name: string;
  avatarSeed: string | null;
  themeKey: string | null;
  role: string | null;
  accountId: string | null;
  bio: string | null;
  email: string | null;
  timezone: string | null;
};

export async function fetchChannelMembers(
  orgId: string,
  channelId: string,
  profileId: string,
): Promise<ChannelMemberProfileItem[]> {
  if (!orgId || !channelId || !profileId) return [];
  return apiGet(`/channels/${channelId}/members`, {
    orgId,
    profileId,
  });
}

export async function fetchNotificationPreferences(orgId: string, profileId: string) {
  const data = await apiGet<Array<Record<string, unknown>>>('/notification-preferences', {
    orgId,
    profileId,
  });
  return (data ?? []).filter(
    (row) => (row as { pref_key?: string | null }).pref_key !== '__push__',
  );
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
  return apiGet<Array<Record<string, unknown>>>('/profiles/by-account-ids', {
    orgId,
    accountIds: accountIds.join(','),
  });
}
