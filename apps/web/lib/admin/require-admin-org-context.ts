import { requireEffectiveActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export type AdminOrgContextSuccess = {
  ok: true;
  orgId: string;
  actorProfileId: string;
};

export type AdminOrgContextFailure = {
  ok: false;
  status: number;
  message: string;
};

export type AdminOrgContextResult = AdminOrgContextSuccess | AdminOrgContextFailure;

export class AdminOrgContextError extends Error {
  status: number;

  constructor(context: AdminOrgContextFailure) {
    super(context.message);
    this.name = 'AdminOrgContextError';
    this.status = context.status;
  }
}

function isAllowedAdminRole(roleKey: string | null | undefined) {
  return roleKey === 'owner' || roleKey === 'admin' || roleKey === 'staff';
}

export async function requireAdminOrgContext(
  orgId: string,
  _options?: { allowStaff?: boolean },
): Promise<AdminOrgContextResult> {
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
    isAllowedAdminRole(role.role_key),
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

export function throwAdminOrgContextError(
  context: AdminOrgContextResult,
): asserts context is AdminOrgContextSuccess {
  if (!context.ok) {
    throw new AdminOrgContextError(context);
  }
}
