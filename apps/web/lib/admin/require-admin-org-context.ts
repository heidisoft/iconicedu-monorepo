import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
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
  let actor;
  try {
    actor = await requireEffectiveActorContext(supabase, { orgId });
  } catch {
    return { ok: false as const, status: 401, message: 'Unauthorized' };
  }
  if (actor.isViewingAsChild) {
    return {
      ok: false as const,
      status: 403,
      message: 'Switch back to Parent to perform this action.',
    };
  }

  const rolesResponse = await getUserRoles(
    supabase,
    actor.account.id,
    actor.account.org_id,
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

  return {
    ok: true as const,
    orgId,
    actorProfileId: actor.profile.id,
  };
}
