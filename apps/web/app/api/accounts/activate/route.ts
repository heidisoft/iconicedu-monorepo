import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { updateAccountStatus } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';

export async function POST() {
  const sessionSupabase = await createSupabaseServerClient();
  const { data } = await sessionSupabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceSupabase = createSupabaseServiceClient();

  try {
    const existingAccountResponse = await getAccountByAuthUserId(
      serviceSupabase,
      data.user.id,
    );
    let account = existingAccountResponse.data ?? null;

    if (!account) {
      const { data: firstOrg, error: firstOrgError } = await serviceSupabase
        .from('orgs')
        .select('id')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (firstOrgError) {
        throw firstOrgError;
      }

      if (!firstOrg?.id) {
        return NextResponse.json({
          status: 'needs_org_setup',
          onboarding: {
            requiresOrgSetup: true,
            requiresRoleSelection: false,
            destination: null,
          },
        });
      }

      const created = await getOrCreateAccount(serviceSupabase, {
        orgId: firstOrg.id,
        authUserId: data.user.id,
        authEmail: data.user.email ?? null,
      });
      account = created.account;
    }

    const statusResponse = await updateAccountStatus(
      serviceSupabase,
      account.id,
      account.org_id,
      'active',
      data.user.id,
    );
    const activeAccount = statusResponse.data ?? account;
    const rolesResponse = await getUserRoles(
      serviceSupabase,
      account.id,
      account.org_id,
    );
    if (rolesResponse.error) {
      throw rolesResponse.error;
    }
    const onboarding = buildAuthOnboardingState(activeAccount, rolesResponse.data ?? []);
    if (onboarding.destination === '/d') {
      onboarding.destination = await resolveOrgDashboardPath(
        serviceSupabase,
        activeAccount.org_id,
      );
    }

    return NextResponse.json({
      status: 'active',
      onboarding,
    });
  } catch (error) {
    console.error('activate-account', error);
    return NextResponse.json(
      { error: 'Unable to activate account' },
      { status: 500 },
    );
  }
}
