import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { notFound, redirect } from 'next/navigation';

export async function getDashboardAccountContext(orgSlug: string) {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const requestedOrg = await buildOrgBySlug(supabase, orgSlug);

  if (!requestedOrg) {
    notFound();
  }

  const { account } = await getOrCreateAccount(supabase, {
    orgId: requestedOrg.id,
    authUserId: authUser.id,
    authEmail: authUser.email ?? null,
  });

  if (account.org_id !== requestedOrg.id) {
    const destination = await resolveOrgDashboardPath(supabase, account.org_id);
    redirect(destination);
  }

  const dashboardPath = await resolveOrgDashboardPath(supabase, account.org_id);

  return {
    supabase,
    authUser,
    account,
    dashboardPath,
  };
}

export async function getDashboardProfileContext(
  supabase: SupabaseClient,
  accountId: string,
): Promise<{
  profileResponse: Awaited<ReturnType<typeof getProfileByAccountId>>;
  currentUserProfile: Awaited<ReturnType<typeof buildUserProfileById>> | null;
}> {
  const profileResponse = await getProfileByAccountId(supabase, accountId);
  const currentUserProfile = profileResponse.data
    ? await buildUserProfileById(supabase, profileResponse.data.id)
    : null;

  return {
    profileResponse,
    currentUserProfile,
  };
}
