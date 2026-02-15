import type {
  NotificationDefaultsVM,
  NotificationPreferenceVM,
  PresenceVM,
  UserAccountVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapAccountRowToVM, mapUserRoles } from '@iconicedu/web/lib/accounts/mappers/account.mapper';
import { mapBaseProfile } from '@iconicedu/web/lib/profile/mappers/base-profile.mapper';
import {
  deriveProfileKind,
  resolveAvatarSource,
  resolveExternalAvatarUrl,
} from '@iconicedu/web/lib/profile/derive';
import { createSignedAvatarUrl } from '@iconicedu/web/lib/profile/queries/avatar.query';
import { getAccountById } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getNotificationDefaults } from '@iconicedu/web/lib/profile/queries/notification-defaults.query';
import { getPresence } from '@iconicedu/web/lib/profile/queries/presence.query';
import { mapProfilePresenceRowToVM } from '@iconicedu/web/lib/profile/mappers/presence.mapper';
import {
  getProfileByAccountId,
  insertProfileForAccount,
  updateProfileAvatar,
  upsertProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { buildChildProfile } from '@iconicedu/web/lib/profile/builders/child.builder';
import { buildEducatorProfile } from '@iconicedu/web/lib/profile/builders/educator.builder';
import { buildGuardianProfile } from '@iconicedu/web/lib/profile/builders/guardian.builder';
import { buildStaffProfile } from '@iconicedu/web/lib/profile/builders/staff.builder';
import { getGuardianFamilyInvites } from '@iconicedu/web/lib/profile/queries/family-link-invites.query';
import {
  findFamilyInviteForAccount,
  mapFamilyLinkInviteRowToVM,
  type FamilyLinkInviteRow,
} from '@iconicedu/web/lib/family/queries/invite.query';

export async function buildSidebarUser(
  supabase: SupabaseClient,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  },
  account: { id: string; org_id: string },
  familyInvite?: FamilyLinkInviteRow | null,
  profileKindOverride?: UserProfileVM['kind'],
): Promise<{ accountVM: UserAccountVM; profileVM: UserProfileVM }> {
  const [accountRow, roleRows, profileResponse] = await Promise.all([
    getAccountById(supabase, account.id),
    getUserRoles(supabase, account.id, account.org_id),
    getProfileByAccountId(supabase, account.id),
  ]);

  const userRoles = mapUserRoles(roleRows.data ?? []);
  const accountVM = mapAccountRowToVM(accountRow.data as AccountRow | null, {
    accountId: account.id,
    orgId: account.org_id,
    authEmail: user.email ?? null,
    userRoles,
  });

  let profileRow = profileResponse.data as ProfileRow | null;
  const externalAvatarUrl = resolveExternalAvatarUrl(user);
  const inviteRow =
    familyInvite ??
    (await findFamilyInviteForAccount({
      supabase,
      orgId: account.org_id,
      accountId: account.id,
      email: user.email ?? null,
    }));
  const derivedKind =
    profileKindOverride ?? inviteRow?.invited_role ?? deriveProfileKind(userRoles);

  if (!profileRow) {
    const upserted = await upsertProfileForAccount(supabase, {
      orgId: account.org_id,
      accountId: account.id,
      kind: derivedKind,
      avatarSource: externalAvatarUrl ? 'external' : 'seed',
      avatarUrl: externalAvatarUrl,
      avatarSeed: user.id,
      timezone: 'UTC',
      locale: 'en-US',
      status: 'active',
      uiThemeKey: 'teal',
    });

    if (upserted.error?.code === '42P10') {
      const fallback = await insertProfileForAccount(supabase, {
        orgId: account.org_id,
        accountId: account.id,
        kind: derivedKind,
        avatarSource: externalAvatarUrl ? 'external' : 'seed',
        avatarUrl: externalAvatarUrl,
        avatarSeed: user.id,
        timezone: 'UTC',
        locale: 'en-US',
        status: 'active',
        uiThemeKey: 'teal',
      });

      if (fallback.error) {
        throw fallback.error;
      }

      profileRow = fallback.data ?? null;
    } else if (upserted.error) {
      throw upserted.error;
    } else {
      profileRow = upserted.data ?? null;
    }
  }

  if (!profileRow) {
    throw new Error('Profile record missing for authenticated user.');
  }

  if (
    externalAvatarUrl &&
    !profileRow.avatar_url &&
    resolveAvatarSource(profileRow.avatar_source) === 'seed' &&
    !profileRow.avatar_updated_at
  ) {
    const updated = await updateProfileAvatar(supabase, {
      profileId: profileRow.id,
      orgId: profileRow.org_id,
      avatarUrl: externalAvatarUrl,
      avatarSource: 'external',
    });

    if (updated.data) {
      profileRow = updated.data;
    }
  }

  const [notificationDefaults, presence, avatarUrl] = await Promise.all([
    loadNotificationDefaults(supabase, profileRow.org_id, profileRow.id),
    loadPresence(supabase, profileRow.org_id, profileRow.id),
    resolveAvatarUrl(
      supabase,
      profileRow.avatar_source,
      profileRow.avatar_url ?? null,
    ),
  ]);

  const baseProfile = mapBaseProfile(profileRow, {
    notificationDefaults,
    presence,
    avatarUrlOverride: avatarUrl,
  });

  if (profileRow.kind === 'educator') {
    return {
      accountVM,
      profileVM: await buildEducatorProfile(supabase, baseProfile, profileRow),
    };
  }

  if (profileRow.kind === 'child') {
    return {
      accountVM,
      profileVM: await buildChildProfile(supabase, baseProfile, profileRow),
    };
  }

  if (profileRow.kind === 'staff') {
    return {
      accountVM,
      profileVM: await buildStaffProfile(supabase, baseProfile, profileRow),
    };
  }

  if (profileRow.kind === 'guardian') {
    const invitesResponse = await getGuardianFamilyInvites(
      supabase,
      profileRow.org_id,
      profileRow.account_id,
    );
    const invites =
      invitesResponse.data?.map((row) => mapFamilyLinkInviteRowToVM(row)) ?? [];
    const guardianProfile = await buildGuardianProfile(supabase, baseProfile, profileRow);
    return {
      accountVM,
      profileVM: {
        ...guardianProfile,
        familyInvites: invites,
      },
    };
  }

  return {
    accountVM,
    profileVM: {
      ...baseProfile,
      kind: 'system',
    },
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
