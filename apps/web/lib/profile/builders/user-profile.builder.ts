import type {
  FamilyLinkInviteRow,
  NotificationDefaultsVM,
  NotificationPreferenceVM,
  PresenceVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type { ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapBaseProfile } from '@iconicedu/web/lib/profile/mappers/base-profile.mapper';
import { resolveAvatarSource } from '@iconicedu/web/lib/profile/derive';
import { createSignedAvatarUrl } from '@iconicedu/web/lib/profile/queries/avatar.query';
import { getNotificationDefaults } from '@iconicedu/web/lib/profile/queries/notification-defaults.query';
import { getPresence } from '@iconicedu/web/lib/profile/queries/presence.query';
import { mapProfilePresenceRowToVM } from '@iconicedu/web/lib/profile/mappers/presence.mapper';
import {
  getProfileByAccountId,
  getProfileById,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { buildChildProfile } from '@iconicedu/web/lib/profile/builders/child.builder';
import { buildEducatorProfile } from '@iconicedu/web/lib/profile/builders/educator.builder';
import { buildGuardianProfile } from '@iconicedu/web/lib/profile/builders/guardian.builder';
import { buildStaffProfile } from '@iconicedu/web/lib/profile/builders/staff.builder';
import { getGuardianFamilyInvites } from '@iconicedu/web/lib/profile/queries/family-link-invites.query';
import {
  mapFamilyLinkInviteRowToVM,
} from '@iconicedu/web/lib/family/queries/invite.query';

type BuildUserProfileOptions = {
  accountEmail?: string | null;
  includeFamilyInvites?: boolean;
};

export async function buildUserProfileById(
  supabase: SupabaseClient,
  profileId: string,
  options: BuildUserProfileOptions = {},
): Promise<UserProfileVM | null> {
  const profileResponse = await getProfileById(supabase, profileId);
  if (!profileResponse.data) {
    return null;
  }

  return buildUserProfileFromRow(supabase, profileResponse.data, options);
}

export async function buildUserProfileByAccountId(
  supabase: SupabaseClient,
  accountId: string,
  options: BuildUserProfileOptions = {},
): Promise<UserProfileVM | null> {
  const profileResponse = await getProfileByAccountId(supabase, accountId);
  if (!profileResponse.data) {
    return null;
  }

  return buildUserProfileFromRow(supabase, profileResponse.data, options);
}

export async function buildUserProfileFromRow(
  supabase: SupabaseClient,
  profileRow: ProfileRow,
  options: BuildUserProfileOptions = {},
): Promise<UserProfileVM> {
  const [notificationDefaults, presence, avatarUrl] = await Promise.all([
    loadNotificationDefaults(supabase, profileRow.org_id, profileRow.id),
    loadPresence(supabase, profileRow.org_id, profileRow.id),
    resolveAvatarUrl(supabase, profileRow.avatar_source, profileRow.avatar_url ?? null),
  ]);

  const baseProfile = mapBaseProfile(profileRow, {
    notificationDefaults,
    presence,
    avatarUrlOverride: avatarUrl,
    accountEmail: options.accountEmail ?? null,
  });

  if (profileRow.kind === 'educator') {
    return buildEducatorProfile(supabase, baseProfile, profileRow);
  }

  if (profileRow.kind === 'child') {
    return buildChildProfile(supabase, baseProfile, profileRow);
  }

  if (profileRow.kind === 'staff') {
    return buildStaffProfile(supabase, baseProfile, profileRow);
  }

  if (profileRow.kind === 'guardian') {
    const guardianProfile = await buildGuardianProfile(supabase, baseProfile, profileRow);

    if (!options.includeFamilyInvites) {
      return guardianProfile;
    }

    const invitesResponse = await getGuardianFamilyInvites(
      supabase,
      profileRow.org_id,
      profileRow.account_id,
    );
    const invites =
      invitesResponse.data?.map((row: FamilyLinkInviteRow) =>
        mapFamilyLinkInviteRowToVM(row),
      ) ?? [];

    return {
      ...guardianProfile,
      familyInvites: invites,
    };
  }

  return {
    ...baseProfile,
    kind: 'system',
  };
}

async function loadNotificationDefaults(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
): Promise<NotificationDefaultsVM | null> {
  const { data } = await getNotificationDefaults(supabase, orgId, profileId);

  if (!data?.length) {
    return null;
  }

  const defaults: NotificationDefaultsVM = {};
  data.forEach((item) => {
    const channels = Array.isArray(item.channels)
      ? (item.channels.filter(Boolean) as NotificationPreferenceVM['channels'])
      : [];
    defaults[item.pref_key] = {
      channels,
      muted: item.muted ?? null,
    };
  });

  return defaults;
}

async function loadPresence(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
): Promise<PresenceVM | null> {
  const { data } = await getPresence(supabase, orgId, profileId);
  return mapProfilePresenceRowToVM(data);
}

async function resolveAvatarUrl(
  supabase: SupabaseClient,
  avatarSource: string,
  avatarUrl: string | null,
): Promise<string | null> {
  if (!avatarUrl) {
    return null;
  }

  if (resolveAvatarSource(avatarSource) !== 'upload') {
    return avatarUrl;
  }

  const { data, error } = await createSignedAvatarUrl(supabase, avatarUrl);
  if (error) {
    return null;
  }

  return data?.signedUrl ?? null;
}
