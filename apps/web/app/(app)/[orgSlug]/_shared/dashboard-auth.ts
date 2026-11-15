import { cache } from 'react';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { buildUserProfileById } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { getProfileByAccountId } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getAccountById } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  resolveEffectiveProfileForAccountInOrg,
  type EffectiveProfileResolution,
} from '@iconicedu/web/lib/family-view/effective-profile';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { notFound, redirect } from 'next/navigation';

// Request-scoped: every `[orgSlug]` layout and page resolves auth/account context via
// this function. Wrapping it in React's `cache()` means the first caller in a given
// request does the work (auth lookup, org lookup, account upsert, dashboard path) and
// every other caller in the same request tree — the layout, the home page, any nested
// page — gets the memoized result instead of repeating the same round trips.
export const getDashboardAccountContext = cache(async (orgSlug: string) => {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const requestedOrg = await buildOrgBySlug(supabase, orgSlug);

  if (!requestedOrg) {
    notFound();
  }

  const { account, invite } = await getOrCreateAccount(supabase, {
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
    invite,
    dashboardPath,
  };
});

// `resolveEffectiveProfileForAccountInOrg` itself isn't cache()-friendly to call
// directly from two places: it takes a full `account` object, and a fresh
// `{ account, authUserId }` literal at each call site defeats `cache()`'s
// argument-identity dedup. This wrapper narrows the cache key to a primitive
// `accountId` (re-fetching the account row itself, then reading its own
// `auth_user_id`) so `layout.tsx` and `getDashboardProfileContext` — which both need
// the same account's family-view resolution — collapse to one call per request, as
// long as they share the `supabase` instance from `getDashboardAccountContext`.
// Scoped to this dashboard module rather than added to `resolveEffectiveProfileForAccountInOrg`
// itself, since that function is also called from non-dashboard paths (e.g. message
// actions) that already have their own account row and shouldn't gain an extra DB
// round trip or a new caching behavior they didn't ask for.
export const getDashboardFamilyViewResolution = cache(
  async (
    supabase: SupabaseClient,
    accountId: string,
  ): Promise<EffectiveProfileResolution | null> => {
    const accountResponse = await getAccountById(supabase, accountId);
    const account = accountResponse.data;
    if (!account?.auth_user_id) {
      return null;
    }
    return resolveEffectiveProfileForAccountInOrg(supabase, {
      account,
      authUserId: account.auth_user_id,
    });
  },
);

export const getDashboardProfileContext = cache(async function getDashboardProfileContext(
  supabase: SupabaseClient,
  accountId: string,
): Promise<{
  profileResponse: Awaited<ReturnType<typeof getProfileByAccountId>>;
  currentUserProfile: Awaited<ReturnType<typeof buildUserProfileById>> | null;
}> {
  const familyViewResolution = await getDashboardFamilyViewResolution(
    supabase,
    accountId,
  );

  const profileResponse: Awaited<ReturnType<typeof getProfileByAccountId>> =
    familyViewResolution
      ? ({
          data: familyViewResolution.effectiveProfile,
          error: null,
        } as Awaited<ReturnType<typeof getProfileByAccountId>>)
      : await getProfileByAccountId(supabase, accountId);

  const currentUserProfile = profileResponse.data
    ? await buildUserProfileById(supabase, profileResponse.data.id)
    : null;

  return {
    profileResponse,
    currentUserProfile,
  };
});
