import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

function isAllowedAdminRole(roleKey: string | null | undefined) {
  return roleKey === 'owner' || roleKey === 'admin';
}

export async function requireAdminOrgContext(
  orgId: string,
  options?: { allowStaff?: boolean },
) {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const accountResponse = await getAccountByAuthUserIdInOrg(supabase, authUser.id, orgId);

  if (!accountResponse.data) {
    return { ok: false as const, status: 401, message: 'Unauthorized' };
  }

  const rolesResponse = await getUserRoles(
    supabase,
    accountResponse.data.id,
    accountResponse.data.org_id,
  );
  if (rolesResponse.error) {
    return { ok: false as const, status: 500, message: rolesResponse.error.message };
  }

  const hasAdminRole = (rolesResponse.data ?? []).some((role) =>
    options?.allowStaff && role.role_key === 'staff'
      ? true
      : isAllowedAdminRole(role.role_key),
  );
  if (!hasAdminRole) {
    return { ok: false as const, status: 403, message: 'Forbidden' };
  }

  const profileResponse = await getProfileByAccountId(supabase, accountResponse.data.id);
  if (profileResponse.error) {
    return { ok: false as const, status: 500, message: profileResponse.error.message };
  }

  return {
    ok: true as const,
    orgId,
    actorProfileId: profileResponse.data?.id ?? null,
  };
}
