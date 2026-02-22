import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { updateAccountStatus } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';
import { getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';

type ActivationIntent = 'login' | 'get-started' | null;

function parseIntent(value: string | null): ActivationIntent {
  if (value === 'login' || value === 'get-started') {
    return value;
  }
  return null;
}

async function resolveOrgLoginPath(orgId: string): Promise<string> {
  const serviceSupabase = createSupabaseServiceClient();
  const dashboardPath = await resolveOrgDashboardPath(serviceSupabase, orgId);
  if (dashboardPath === '/d') {
    return '/login';
  }
  return `${dashboardPath}/login`;
}

export async function POST(request: Request) {
  const sessionSupabase = await createSupabaseServerClient();
  const { data } = await sessionSupabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { searchParams } = new URL(request.url);
  const orgSlugParam = searchParams.get('org')?.trim().toLowerCase() ?? '';
  const orgSlug = orgSlugParam || null;
  const intent = parseIntent(searchParams.get('intent'));

  try {
    let requestedOrgId: string | null = null;
    let requestedOrgSlug: string | null = null;
    if (orgSlug) {
      const orgResponse = await getOrgBySlug(serviceSupabase, orgSlug);
      if (orgResponse.error) {
        throw orgResponse.error;
      }
      if (!orgResponse.data) {
        return NextResponse.json({
          status: 'invalid_org',
          onboarding: {
            requiresOrgSetup: false,
            requiresRoleSelection: false,
            destination: '/login',
          },
        });
      }
      requestedOrgId = orgResponse.data.id;
      requestedOrgSlug = orgResponse.data.slug;
    }

    const existingAccountResponse = await getAccountByAuthUserId(
      serviceSupabase,
      data.user.id,
    );
    let account = existingAccountResponse.data ?? null;

    if (!account) {
      const destination = requestedOrgSlug
        ? `/${requestedOrgSlug}/get-started`
        : '/get-started';
      return NextResponse.json({
        status: 'needs_org_setup',
        onboarding: {
          requiresOrgSetup: true,
          requiresRoleSelection: false,
          destination,
        },
      });
    }

    if (requestedOrgId && account.org_id !== requestedOrgId) {
      return NextResponse.json({
        status: 'active',
        onboarding: {
          requiresOrgSetup: false,
          requiresRoleSelection: false,
          destination: await resolveOrgLoginPath(account.org_id),
        },
      });
    }

    if (!account) {
      return NextResponse.json({
        status: 'needs_org_setup',
        onboarding: {
          requiresOrgSetup: true,
          requiresRoleSelection: false,
          destination: '/get-started',
        },
      });
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
    if (onboarding.requiresRoleSelection) {
      onboarding.requiresRoleSelection = false;
      onboarding.destination = await resolveOrgLoginPath(activeAccount.org_id);
    } else if (onboarding.destination === '/d') {
      onboarding.destination =
        intent === 'get-started'
          ? await resolveOrgLoginPath(activeAccount.org_id)
          : await resolveOrgDashboardPath(serviceSupabase, activeAccount.org_id);
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
