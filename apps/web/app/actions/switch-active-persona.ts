'use server';

import { revalidatePath } from 'next/cache';

import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import {
  getProfileById,
  getProfilesByAccountId,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { updateAccountActiveProfile } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import type { UserProfileVM } from '@iconicedu/shared-types';
import { enablePersonaSwitch } from '@iconicedu/web/flags';

type SwitchActivePersonaInput = {
  orgId: string;
  orgSlug: string;
  profileId?: string;
  kind?: UserProfileVM['kind'];
};

function roleKeyFromKind(kind: UserProfileVM['kind']): string | null {
  if (kind === 'educator') {
    return 'educator';
  }
  if (kind === 'guardian') {
    return 'guardian';
  }
  if (kind === 'child') {
    return 'child';
  }
  if (kind === 'staff') {
    return 'staff';
  }
  return null;
}

export async function switchActivePersonaAction(input: SwitchActivePersonaInput) {
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

  const isEnabled = await enablePersonaSwitch.run({
    identify: {
      profileId: account.active_profile_id ?? undefined,
    },
  });
  if (!isEnabled) {
    throw new Error('Persona switch is disabled.');
  }

  let targetProfileId = input.profileId ?? null;
  if (!targetProfileId && input.kind) {
    const profilesResponse = await getProfilesByAccountId(supabase, account.id);
    const profile = (profilesResponse.data ?? []).find((row) => row.kind === input.kind);
    targetProfileId = profile?.id ?? null;
  }

  if (!targetProfileId) {
    throw new Error('No target persona profile found.');
  }

  const profileResponse = await getProfileById(supabase, targetProfileId);
  const profile = profileResponse.data;
  if (!profile || profile.org_id !== input.orgId || profile.account_id !== account.id) {
    throw new Error('Profile is not available for this account.');
  }

  const targetRoleKey = roleKeyFromKind(profile.kind as UserProfileVM['kind']);
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

  const updateResponse = await updateAccountActiveProfile(supabase, {
    accountId: account.id,
    orgId: input.orgId,
    activeProfileId: profile.id,
    updatedBy: authUser.id,
  });

  if (updateResponse.error) {
    throw new Error(updateResponse.error.message);
  }

  revalidatePath(`/${input.orgSlug}`);

  return {
    success: true as const,
    profileId: profile.id,
    kind: profile.kind,
  };
}
