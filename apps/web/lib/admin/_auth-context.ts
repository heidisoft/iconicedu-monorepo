import {
  ParentModeRequiredError,
  requireEffectiveActorContext,
} from '@iconicedu/web/lib/family-view/actor-context';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export type AdminAuthContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  accountId: string;
  orgId: string;
  profileId: string;
  now: string;
};

function isAdminManagerRole(roleKey: string | null | undefined) {
  return roleKey === 'owner' || roleKey === 'admin' || roleKey === 'staff';
}

export async function requireAdminAuthContext(): Promise<AdminAuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const actor = await requireEffectiveActorContext(supabase);
  if (actor.isViewingAsChild) {
    throw new ParentModeRequiredError();
  }

  const rolesResponse = await getUserRoles(
    supabase,
    actor.account.id,
    actor.account.org_id,
  );
  if (rolesResponse.error) {
    throw new Error(rolesResponse.error.message);
  }

  const hasManagerRole = (rolesResponse.data ?? []).some((role) =>
    isAdminManagerRole(role.role_key),
  );
  if (!hasManagerRole) {
    throw new Error('Forbidden');
  }

  return {
    supabase,
    accountId: actor.account.id,
    orgId: actor.account.org_id,
    profileId: actor.profile.id,
    now: new Date().toISOString(),
  };
}
