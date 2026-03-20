import type {
  FamilyLinkInviteRow,
  NotificationDefaultsVM,
  NotificationScopedPreferenceVM,
  NotificationPreferenceVM,
  PresenceVM,
  UserAccountVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type { AccountRow, ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  mapAccountRowToVM,
  mapUserRoles,
} from '@iconicedu/web/lib/accounts/mappers/account.mapper';
import { resolveProfileAvatarUrl } from '@iconicedu/web/lib/profile/avatar-url';
import { mapBaseProfile } from '@iconicedu/web/lib/profile/mappers/base-profile.mapper';
import {
  deriveProfileKind,
  profileKindFromRoleKey,
  resolveAvatarSource,
  resolveExternalAvatarUrl,
} from '@iconicedu/web/lib/profile/derive';
import {
  getAccountById,
  updateAccountActiveProfile,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getNotificationDefaults } from '@iconicedu/web/lib/profile/queries/notification-defaults.query';
import { seedSignupDefaultNotificationPreferences } from '@iconicedu/web/lib/profile/queries/notification-defaults-seed.query';
import { getNotificationScopedDefaults } from '@iconicedu/web/lib/profile/queries/notification-scoped-defaults.query';
import { getPresence } from '@iconicedu/web/lib/profile/queries/presence.query';
import { mapProfilePresenceRowToVM } from '@iconicedu/web/lib/profile/mappers/presence.mapper';
import {
  getProfilesByAccountId,
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
} from '@iconicedu/web/lib/family/queries/invite.query';

type PersonaDecisionReason = 'missing-role' | 'already-exists' | 'addable';
type AddablePersonaKind = 'educator' | 'guardian' | 'child' | 'staff';

type PersonaAddableEvaluation = {
  addablePersonas: Array<{
    kind: AddablePersonaKind;
    label: string;
  }>;
  roleKeys: Set<string>;
  existingKinds: Set<string>;
  reasons: Record<AddablePersonaKind, PersonaDecisionReason>;
};

function logPersonaAddableEvaluation(_input: {
  accountId: string;
  orgId: string;
  activeProfileId: string | null;
  derivedKind: UserProfileVM['kind'];
  primaryRole: AccountRow['primary_role'] | null;
  evaluation: PersonaAddableEvaluation;
}) {
  return;
}

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
  effectiveProfileRow?: ProfileRow | null,
): Promise<{
  accountVM: UserAccountVM;
  profileVM: UserProfileVM;
  availablePersonas: Array<{
    profileId: string;
    kind: UserProfileVM['kind'];
    label: string;
    displayName?: string | null;
    isActive: boolean;
  }>;
  addablePersonas: Array<{
    kind: UserProfileVM['kind'];
    label: string;
  }>;
}> {
  const [accountRow, roleRows, profilesResponse] = await Promise.all([
    getAccountById(supabase, account.id),
    getUserRoles(supabase, account.id, account.org_id),
    getProfilesByAccountId(supabase, account.id),
  ]);

  const userRoles = mapUserRoles(roleRows.data ?? []);
  const accountVM = mapAccountRowToVM(accountRow.data as AccountRow | null, {
    accountId: account.id,
    orgId: account.org_id,
    authEmail: user.email ?? null,
    userRoles,
  });

  let profileRows = (profilesResponse.data ?? []) as ProfileRow[];
  let profileRow: ProfileRow | null = null;
  let createdProfile = false;
  const externalAvatarUrl = resolveExternalAvatarUrl(user);
  const inviteRow =
    familyInvite ??
    (await findFamilyInviteForAccount({
      supabase,
      orgId: account.org_id,
      accountId: account.id,
      email: user.email ?? null,
    }));
  const accountPrimaryRoleKind = accountRow.data?.primary_role
    ? profileKindFromRoleKey(accountRow.data.primary_role)
    : null;
  const derivedKind =
    profileKindOverride ??
    inviteRow?.invited_role ??
    accountPrimaryRoleKind ??
    deriveProfileKind(userRoles);
  const addableEvaluation = buildAddablePersonaEvaluation({
    userRoles,
    primaryRole: accountRow.data?.primary_role ?? null,
    profileRows,
  });
  const addablePersonas = addableEvaluation.addablePersonas;

  logPersonaAddableEvaluation({
    accountId: account.id,
    orgId: account.org_id,
    activeProfileId: accountRow.data?.active_profile_id ?? null,
    derivedKind,
    primaryRole: accountRow.data?.primary_role ?? null,
    evaluation: addableEvaluation,
  });

  profileRow =
    effectiveProfileRow ??
    profileRows.find((row) => row.id === accountRow.data?.active_profile_id) ??
    profileRows.find((row) => row.kind === derivedKind) ??
    profileRows[0] ??
    null;

  if (
    !effectiveProfileRow &&
    (!profileRow || !profileRows.some((row) => row.kind === derivedKind))
  ) {
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
      createdProfile = Boolean(profileRow);
      if (profileRow) {
        profileRows = [
          profileRow,
          ...profileRows.filter((row) => row.id !== profileRow?.id),
        ];
      }
    } else if (upserted.error) {
      throw upserted.error;
    } else {
      profileRow = upserted.data ?? null;
      createdProfile = Boolean(profileRow);
      if (profileRow) {
        profileRows = [
          profileRow,
          ...profileRows.filter((row) => row.id !== profileRow?.id),
        ];
      }
    }
  }

  if (!profileRow) {
    throw new Error('Profile record missing for authenticated user.');
  }

  if (!effectiveProfileRow && accountRow.data?.active_profile_id !== profileRow.id) {
    await updateAccountActiveProfile(supabase, {
      accountId: account.id,
      orgId: account.org_id,
      activeProfileId: profileRow.id,
      updatedBy: user.id,
    });
  }

  if (createdProfile) {
    const seedResponse = await seedSignupDefaultNotificationPreferences(
      supabase,
      profileRow.org_id,
      profileRow.id,
    );
    if (seedResponse.error) {
      throw seedResponse.error;
    }
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

  const [notificationDefaults, notificationScopedDefaults, presence, avatarUrl] =
    await Promise.all([
      loadNotificationDefaults(supabase, profileRow.org_id, profileRow.id),
      loadNotificationScopedDefaults(supabase, profileRow.org_id, profileRow.id),
      loadPresence(supabase, profileRow.org_id, profileRow.id),
      resolveAvatarUrl(supabase, profileRow.avatar_source, profileRow.avatar_url ?? null),
    ]);

  const baseProfile = mapBaseProfile(profileRow, {
    notificationDefaults,
    notificationScopedDefaults,
    presence,
    avatarUrlOverride: avatarUrl,
  });

  if (profileRow.kind === 'educator') {
    return {
      accountVM,
      profileVM: await buildEducatorProfile(supabase, baseProfile, profileRow),
      availablePersonas: buildAvailablePersonas(profileRows, profileRow.id),
      addablePersonas,
    };
  }

  if (profileRow.kind === 'child') {
    return {
      accountVM,
      profileVM: await buildChildProfile(supabase, baseProfile, profileRow),
      availablePersonas: buildAvailablePersonas(profileRows, profileRow.id),
      addablePersonas,
    };
  }

  if (profileRow.kind === 'staff') {
    return {
      accountVM,
      profileVM: await buildStaffProfile(supabase, baseProfile, profileRow),
      availablePersonas: buildAvailablePersonas(profileRows, profileRow.id),
      addablePersonas,
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
      availablePersonas: buildAvailablePersonas(profileRows, profileRow.id),
      addablePersonas,
    };
  }

  return {
    accountVM,
    profileVM: {
      ...baseProfile,
      kind: 'system',
    },
    availablePersonas: buildAvailablePersonas(profileRows, profileRow.id),
    addablePersonas,
  };
}

function buildAvailablePersonas(profileRows: ProfileRow[], activeProfileId: string) {
  return Array.from(
    new Map(
      profileRows.map((row) => [
        row.id,
        {
          profileId: row.id,
          kind: row.kind as UserProfileVM['kind'],
          label: toPersonaLabel(row.kind),
          displayName: row.display_name ?? null,
          isActive: row.id === activeProfileId,
        },
      ]),
    ).values(),
  );
}

function toPersonaLabel(kind: string): string {
  if (kind === 'educator') {
    return 'Tutor';
  }
  if (kind === 'guardian') {
    return 'Parent';
  }
  if (kind === 'child') {
    return 'Student';
  }
  if (kind === 'staff') {
    return 'Staff';
  }
  return 'Profile';
}

function buildAddablePersonaEvaluation(input: {
  userRoles: ReturnType<typeof mapUserRoles>;
  primaryRole: AccountRow['primary_role'] | null;
  profileRows: ProfileRow[];
}): PersonaAddableEvaluation {
  const existingKinds = new Set(input.profileRows.map((profile) => profile.kind));
  const roleKeys = new Set(input.userRoles.map((role) => role.roleKey));
  if (input.primaryRole) {
    roleKeys.add(input.primaryRole);
  }

  const staffHasRole =
    roleKeys.has('staff') || roleKeys.has('owner') || roleKeys.has('admin');
  const reasons: Record<AddablePersonaKind, PersonaDecisionReason> = {
    educator: !roleKeys.has('educator')
      ? 'missing-role'
      : existingKinds.has('educator')
        ? 'already-exists'
        : 'addable',
    guardian: !roleKeys.has('guardian')
      ? 'missing-role'
      : existingKinds.has('guardian')
        ? 'already-exists'
        : 'addable',
    child: !roleKeys.has('child')
      ? 'missing-role'
      : existingKinds.has('child')
        ? 'already-exists'
        : 'addable',
    staff: !staffHasRole
      ? 'missing-role'
      : existingKinds.has('staff')
        ? 'already-exists'
        : 'addable',
  };

  const orderedKinds: AddablePersonaKind[] = ['educator', 'guardian', 'child', 'staff'];
  const addablePersonas = orderedKinds
    .filter((kind) => reasons[kind] === 'addable')
    .map((kind) => ({
      kind,
      label: toPersonaLabel(kind),
    }));

  return {
    addablePersonas,
    roleKeys,
    existingKinds,
    reasons,
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
    const notificationKey = item.pref_key as keyof NotificationDefaultsVM;
    const channels = Array.isArray(item.channels)
      ? (item.channels.filter(Boolean) as NotificationPreferenceVM['channels'])
      : [];
    defaults[notificationKey] = {
      channels,
      muted: item.muted ?? null,
    };
  });

  return defaults;
}

export const __test__ = {
  buildAddablePersonaEvaluation,
  logPersonaAddableEvaluation,
};

async function loadNotificationScopedDefaults(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
): Promise<NotificationScopedPreferenceVM[] | null> {
  const { data } = await getNotificationScopedDefaults(supabase, orgId, profileId);

  if (!data?.length) {
    return null;
  }

  return data
    .map((item) => ({
      scopeKind: item.scope_kind,
      scopeId: item.scope_id,
      prefKey: item.pref_key,
      channels: Array.isArray(item.channels)
        ? (item.channels.filter(Boolean) as NotificationPreferenceVM['channels'])
        : [],
      muted: item.muted ?? null,
    }))
    .filter(
      (item) => item.scopeKind === 'channel' || item.scopeKind === 'learning_space',
    );
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
  return resolveProfileAvatarUrl(supabase, avatarSource, avatarUrl);
}
