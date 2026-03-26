'use server';

import { revalidatePath } from 'next/cache';
import type { UserProfileVM } from '@iconicedu/shared-types';

import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import {
  getProfilesByAccountId,
  insertProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';

type AddPersonaInput = {
  orgId: string;
  orgSlug: string;
  kind: UserProfileVM['kind'];
};

function roleKeyFromKind(kind: UserProfileVM['kind']): string | null {
  if (kind === 'educator') return 'educator';
  if (kind === 'guardian') return 'guardian';
  if (kind === 'child') return 'child';
  if (kind === 'staff') return 'staff';
  return null;
}

export async function addPersonaAction(input: AddPersonaInput) {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserIdInOrg(
    supabase,
    authUser.id,
    input.orgId,
  );
  const account = accountResponse.data;
  if (!account) {
    throw new Error('Account not found for organization.');
  }

  const targetRoleKey = roleKeyFromKind(input.kind);
  if (!targetRoleKey) {
    throw new Error('Unsupported persona kind.');
  }

  const rolesResponse = await getUserRoles(supabase, account.id, input.orgId);
  const hasRole =
    (rolesResponse.data ?? []).some((role) => role.role_key === targetRoleKey) ||
    (targetRoleKey === 'staff' &&
      (account.primary_role === 'owner' || account.primary_role === 'admin'));
  if (!hasRole) {
    throw new Error('Required role is not assigned for this persona.');
  }

  const profilesResponse = await getProfilesByAccountId(supabase, account.id);
  const existingProfiles = profilesResponse.data ?? [];
  if (existingProfiles.some((profile) => profile.kind === input.kind)) {
    throw new Error('Persona already exists for this account.');
  }

  const sourceProfile =
    existingProfiles.find((profile) => profile.id === account.active_profile_id) ??
    existingProfiles[0];
  const insertResponse = await insertProfileForAccount(supabase, {
    orgId: input.orgId,
    accountId: account.id,
    kind: input.kind,
    displayName: sourceProfile?.display_name ?? null,
    avatarSource: sourceProfile?.avatar_source ?? 'seed',
    avatarUrl: sourceProfile?.avatar_url ?? null,
    avatarSeed: sourceProfile?.avatar_seed ?? account.id,
    timezone: sourceProfile?.timezone ?? 'UTC',
    locale: sourceProfile?.locale ?? 'en-US',
    status: sourceProfile?.status ?? 'active',
    uiThemeKey: sourceProfile?.ui_theme_key ?? 'teal',
  });
  if (insertResponse.error || !insertResponse.data) {
    throw new Error(insertResponse.error?.message ?? 'Unable to create persona profile.');
  }

  revalidatePath(`/${input.orgSlug}`);
  return {
    success: true as const,
    profileId: insertResponse.data.id,
    kind: insertResponse.data.kind,
  };
}
