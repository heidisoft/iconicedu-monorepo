import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import {
  getAccountByAuthUserId,
  updateAccountRoleState,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  getUserRoles,
  upsertUserRole,
} from '@iconicedu/web/lib/profile/queries/roles.query';
import {
  getProfileByAccountId,
  insertProfileForAccount,
  updateProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { seedSignupDefaultNotificationPreferences } from '@iconicedu/web/lib/profile/queries/notification-defaults-seed.query';
import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { resolveOrgLoginPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { getDefaultOrg, getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';

type RoleChoice = 'parent' | 'educator' | 'student' | 'staff';

function parseRole(value: unknown): RoleChoice | null {
  if (
    value === 'parent' ||
    value === 'educator' ||
    value === 'student' ||
    value === 'staff'
  ) {
    return value;
  }
  return null;
}

function isStaffEmailAllowed(email: string | null | undefined): boolean {
  const domains = (process.env.STAFF_EMAIL_DOMAIN_ALLOWLIST ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!domains.length || !email) {
    return false;
  }
  const emailDomain = email.trim().toLowerCase().split('@')[1] ?? '';
  return domains.includes(emailDomain);
}

function isStaffAccessCodeValid(code: string | null | undefined): boolean {
  const expected = process.env.STAFF_ACCESS_CODE?.trim();
  if (!expected) {
    return false;
  }
  return code?.trim() === expected;
}

async function resolveOrgIdForUser(input: {
  serviceSupabase: ReturnType<typeof createSupabaseServiceClient>;
  authUserId: string;
  orgSlug?: string | null;
}): Promise<string | null> {
  if (input.orgSlug) {
    const orgResponse = await getOrgBySlug(input.serviceSupabase, input.orgSlug);
    if (orgResponse.data?.id) {
      return orgResponse.data.id;
    }
  }

  const accountResponse = await getAccountByAuthUserId(
    input.serviceSupabase,
    input.authUserId,
  );
  if (accountResponse.data?.org_id) {
    return accountResponse.data.org_id;
  }

  const defaultOrgResponse = await getDefaultOrg(input.serviceSupabase);
  return defaultOrgResponse.data?.id ?? null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
    staffAccessCode?: unknown;
  } | null;
  const role = parseRole(body?.role);
  if (!role) {
    return NextResponse.json(
      { success: false, message: 'Valid role is required' },
      { status: 400 },
    );
  }

  if (role === 'student') {
    return NextResponse.json(
      { success: false, message: 'Use /api/onboarding/student for student onboarding' },
      { status: 400 },
    );
  }

  const sessionSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sessionSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const serviceSupabase = createSupabaseServiceClient();
  const requestUrl = new URL(request.url);
  const orgSlug = requestUrl.searchParams.get('org');
  const orgId = await resolveOrgIdForUser({
    serviceSupabase,
    authUserId: user.id,
    orgSlug,
  });

  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'No organization found for onboarding' },
      { status: 400 },
    );
  }

  const { account } = await getOrCreateAccount(serviceSupabase, {
    orgId,
    authUserId: user.id,
    authEmail: user.email ?? null,
  });

  if (role === 'staff') {
    const staffAccessCode =
      typeof body?.staffAccessCode === 'string' ? body.staffAccessCode : null;
    const staffAllowed =
      isStaffAccessCodeValid(staffAccessCode) || isStaffEmailAllowed(user.email ?? null);
    if (!staffAllowed) {
      return NextResponse.json(
        {
          success: false,
          message: 'Staff access is restricted. Contact support if you need access.',
        },
        { status: 403 },
      );
    }
  }

  const roleKey = role === 'parent' ? 'guardian' : role;
  const profileKind = roleKey === 'guardian' ? 'guardian' : roleKey;
  const now = new Date().toISOString();
  const roleStatus = role === 'educator' ? 'pending' : 'active';

  const currentProfile = await getProfileByAccountId(serviceSupabase, account.id);
  let profileId = currentProfile.data?.id ?? null;
  const profilePayload = {
    orgId: account.org_id,
    accountId: account.id,
    kind: profileKind,
    displayName: currentProfile.data?.display_name ?? null,
    avatarSource: currentProfile.data?.avatar_source ?? 'seed',
    avatarUrl: currentProfile.data?.avatar_url ?? null,
    avatarSeed: currentProfile.data?.avatar_seed ?? account.id,
    timezone: currentProfile.data?.timezone ?? 'UTC',
    locale: currentProfile.data?.locale ?? 'en-US',
    status: currentProfile.data?.status ?? 'active',
    uiThemeKey: currentProfile.data?.ui_theme_key ?? 'teal',
  } as const;

  if (!currentProfile.data || currentProfile.data.kind !== profileKind) {
    const profileResponse = currentProfile.data
      ? await updateProfileForAccount(serviceSupabase, {
          profileId: currentProfile.data.id,
          ...profilePayload,
        })
      : await insertProfileForAccount(serviceSupabase, profilePayload);
    if (profileResponse.error) {
      return NextResponse.json(
        { success: false, message: profileResponse.error.message },
        { status: 500 },
      );
    }
    profileId = profileResponse.data?.id ?? profileId;
  }

  if (profileId) {
    const seedResponse = await seedSignupDefaultNotificationPreferences(
      serviceSupabase,
      account.org_id,
      profileId,
    );
    if (seedResponse.error) {
      return NextResponse.json(
        { success: false, message: seedResponse.error.message },
        { status: 500 },
      );
    }
  }

  if (roleStatus === 'active') {
    const roleResponse = await upsertUserRole(serviceSupabase, {
      orgId: account.org_id,
      accountId: account.id,
      roleKey: roleKey as 'guardian' | 'staff',
      assignedBy: user.id,
    });
    if (roleResponse.error) {
      return NextResponse.json(
        { success: false, message: roleResponse.error.message },
        { status: 500 },
      );
    }
  }

  const accountRoleStateResponse = await updateAccountRoleState(serviceSupabase, {
    accountId: account.id,
    orgId: account.org_id,
    primaryRole: roleKey,
    roleStatus,
    onboardingCompletedAt: now,
    updatedBy: user.id,
  });

  if (accountRoleStateResponse.error || !accountRoleStateResponse.data) {
    return NextResponse.json(
      {
        success: false,
        message: accountRoleStateResponse.error?.message ?? 'Unable to set account role',
      },
      { status: 500 },
    );
  }

  const rolesResponse = await getUserRoles(serviceSupabase, account.id, account.org_id);
  if (rolesResponse.error) {
    return NextResponse.json(
      { success: false, message: rolesResponse.error.message },
      { status: 500 },
    );
  }

  const onboarding = buildAuthOnboardingState(
    accountRoleStateResponse.data,
    rolesResponse.data ?? [],
  );
  if (onboarding.destination === '/login/pending-access') {
    const loginPath = await resolveOrgLoginPath(
      serviceSupabase,
      accountRoleStateResponse.data.org_id,
    );
    onboarding.destination = `${loginPath}/pending-access`;
  } else if (onboarding.destination === '/dashboard') {
    onboarding.destination = await resolveOrgDashboardPath(
      serviceSupabase,
      accountRoleStateResponse.data.org_id,
    );
  }

  return NextResponse.json({
    success: true,
    onboarding,
  });
}
