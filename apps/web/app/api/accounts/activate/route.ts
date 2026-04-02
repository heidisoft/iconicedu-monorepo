import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import {
  getAccountByAuthUserId,
  getAccountByAuthUserIdInOrg,
  getAccountByEmail,
  insertAccountForAuthUser,
  updateAccountAuthUserId,
  updateAccountStatus,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  getProfileByAccountId,
  insertProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';
import { getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import {
  resolveDefaultOrgLoginPath,
  resolveOrgLoginPath,
} from '@iconicedu/web/lib/org/resolve-auth-path';
import { reportWebObservedError } from '@iconicedu/web/lib/analytics/report-error';

type ActivationIntent = 'login' | 'get-started' | null;

function parseIntent(value: string | null): ActivationIntent {
  if (value === 'login' || value === 'get-started') {
    return value;
  }
  return null;
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
        const fallbackDestination = await resolveDefaultOrgLoginPath(serviceSupabase);
        return NextResponse.json({
          status: 'invalid_org',
          onboarding: {
            requiresOrgSetup: false,
            requiresRoleSelection: false,
            destination: fallbackDestination,
          },
        });
      }
      requestedOrgId = orgResponse.data.id;
      requestedOrgSlug = orgResponse.data.slug;
    }

    let account = null;
    if (requestedOrgId) {
      const requestedOrgAccountResponse = await getAccountByAuthUserIdInOrg(
        serviceSupabase,
        data.user.id,
        requestedOrgId,
      );
      account = requestedOrgAccountResponse.data ?? null;
    } else {
      const existingAccountResponse = await getAccountByAuthUserId(
        serviceSupabase,
        data.user.id,
      );
      account = existingAccountResponse.data ?? null;
    }

    if (!account) {
      if (requestedOrgId && intent === 'get-started') {
        const normalizedEmail = data.user.email?.trim().toLowerCase() ?? null;
        if (normalizedEmail) {
          const invitedAccountResponse = await getAccountByEmail(
            serviceSupabase,
            requestedOrgId,
            normalizedEmail,
          );
          if (invitedAccountResponse.error) {
            throw invitedAccountResponse.error;
          }
          if (invitedAccountResponse.data?.id) {
            const linkedAccountResponse = await updateAccountAuthUserId(
              serviceSupabase,
              invitedAccountResponse.data.id,
              data.user.id,
            );
            if (linkedAccountResponse.error) {
              throw linkedAccountResponse.error;
            }
            account = linkedAccountResponse.data ?? invitedAccountResponse.data;
          }
        }

        if (!account) {
          const insertResponse = await insertAccountForAuthUser(serviceSupabase, {
            orgId: requestedOrgId,
            authUserId: data.user.id,
            email: data.user.email?.trim().toLowerCase() ?? null,
          });
          if (insertResponse.error || !insertResponse.data) {
            throw (
              insertResponse.error ??
              new Error('Unable to create account for organization')
            );
          }
          account = insertResponse.data;
        }
      }
    }

    if (account && requestedOrgId && intent === 'get-started') {
      const profileResponse = await getProfileByAccountId(serviceSupabase, account.id);
      if (profileResponse.error) {
        throw profileResponse.error;
      }
      if (!profileResponse.data) {
        const insertProfileResponse = await insertProfileForAccount(serviceSupabase, {
          orgId: account.org_id,
          accountId: account.id,
          kind: 'guardian',
          displayName: null,
          avatarSource: 'seed',
          avatarUrl: null,
          avatarSeed: account.id,
          timezone: 'UTC',
          locale: 'en-US',
          status: 'active',
          uiThemeKey: 'teal',
        });
        if (insertProfileResponse.error) {
          throw insertProfileResponse.error;
        }
      }
    }

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
    const rolesResponse = await getUserRoles(serviceSupabase, account.id, account.org_id);
    if (rolesResponse.error) {
      throw rolesResponse.error;
    }
    const onboarding = buildAuthOnboardingState(activeAccount, rolesResponse.data ?? []);
    if (onboarding.requiresRoleSelection) {
      if (intent === 'get-started') {
        onboarding.destination = requestedOrgSlug
          ? `/${requestedOrgSlug}/get-started`
          : '/get-started';
      } else {
        onboarding.requiresRoleSelection = false;
        onboarding.destination = await resolveOrgLoginPath(
          serviceSupabase,
          activeAccount.org_id,
        );
      }
    } else if (onboarding.destination === '/login/pending-access') {
      const loginPath = await resolveOrgLoginPath(serviceSupabase, activeAccount.org_id);
      onboarding.destination = `${loginPath}/pending-access`;
    } else if (onboarding.destination === '/dashboard') {
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
    reportWebObservedError({
      error,
      source: 'web.api.accounts.activate',
      message: 'Failed to activate account',
      distinctId: data.user.id,
      context: {
        orgSlug,
        intent,
      },
    });
    return NextResponse.json({ error: 'Unable to activate account' }, { status: 500 });
  }
}
