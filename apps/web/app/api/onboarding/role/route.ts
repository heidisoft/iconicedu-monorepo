import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { getUserRoles, upsertUserRole } from '@iconicedu/web/lib/profile/queries/roles.query';
import {
  getProfileByAccountId,
  insertProfileForAccount,
  updateProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { updateAccountRoleState } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';

type RoleChoice = 'parent' | 'educator' | 'student' | 'staff';

function parseRole(value: unknown): RoleChoice | null {
  if (value === 'parent' || value === 'educator' || value === 'student' || value === 'staff') {
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { role?: unknown; staffAccessCode?: unknown }
    | null;
  const role = parseRole(body?.role);
  if (!role) {
    return NextResponse.json({ success: false, message: 'Valid role is required' }, { status: 400 });
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
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const serviceSupabase = createSupabaseServiceClient();

  const { account } = await getOrCreateAccount(serviceSupabase, {
    orgId: ORG_ID,
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
    return NextResponse.json({ success: false, message: rolesResponse.error.message }, { status: 500 });
  }

  const onboarding = buildAuthOnboardingState(
    accountRoleStateResponse.data,
    rolesResponse.data ?? [],
  );
  if (onboarding.destination === '/dashboard') {
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
