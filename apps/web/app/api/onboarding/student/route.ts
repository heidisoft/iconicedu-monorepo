import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import {
  getAccountByAuthUserId,
  updateAccountRoleState,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getUserRoles, upsertUserRole } from '@iconicedu/web/lib/profile/queries/roles.query';
import {
  getProfileByAccountId,
  insertProfileForAccount,
  updateProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { resolveOrgLoginPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { getDefaultOrg, getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';

type StudentAccessCodeRow = {
  id: string;
  org_id: string;
  family_id: string | null;
  guardian_account_id: string | null;
  status: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
};

function hashInviteCode(input: string): string {
  return createHash('sha256').update(input).digest('hex');
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
  const body = (await request.json().catch(() => null)) as { inviteCode?: unknown } | null;
  const inviteCode = typeof body?.inviteCode === 'string' ? body.inviteCode.trim() : '';

  if (!inviteCode) {
    return NextResponse.json(
      { success: false, message: 'Invite code is required' },
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

  const inviteHash = hashInviteCode(inviteCode);
  const { data: inviteCodeRow, error: codeError } = await serviceSupabase
    .from('student_access_codes')
    .select('id, org_id, family_id, guardian_account_id, status, expires_at, max_uses, uses')
    .eq('org_id', account.org_id)
    .eq('code_hash', inviteHash)
    .is('deleted_at', null)
    .maybeSingle<StudentAccessCodeRow>();

  if (codeError) {
    return NextResponse.json({ success: false, message: codeError.message }, { status: 500 });
  }

  if (!inviteCodeRow || inviteCodeRow.status !== 'active') {
    return NextResponse.json({ success: false, message: 'Invalid invite code' }, { status: 400 });
  }

  if (
    inviteCodeRow.expires_at &&
    new Date(inviteCodeRow.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ success: false, message: 'Invite code has expired' }, { status: 400 });
  }

  if (inviteCodeRow.uses >= inviteCodeRow.max_uses) {
    return NextResponse.json({ success: false, message: 'Invite code has already been used' }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (inviteCodeRow.family_id && inviteCodeRow.guardian_account_id) {
    const linkResponse = await serviceSupabase.from('family_links').upsert(
      {
        org_id: account.org_id,
        family_id: inviteCodeRow.family_id,
        guardian_account_id: inviteCodeRow.guardian_account_id,
        child_account_id: account.id,
        relation: 'guardian',
        permissions_scope: null,
        created_by: user.id,
        updated_by: user.id,
      },
      { onConflict: 'org_id,family_id,guardian_account_id,child_account_id' },
    );

    if (linkResponse.error) {
      return NextResponse.json(
        { success: false, message: linkResponse.error.message },
        { status: 500 },
      );
    }
  }

  const currentProfile = await getProfileByAccountId(serviceSupabase, account.id);
  const profilePayload = {
    orgId: account.org_id,
    accountId: account.id,
    kind: 'child',
    displayName: currentProfile.data?.display_name ?? null,
    avatarSource: currentProfile.data?.avatar_source ?? 'seed',
    avatarUrl: currentProfile.data?.avatar_url ?? null,
    avatarSeed: currentProfile.data?.avatar_seed ?? account.id,
    timezone: currentProfile.data?.timezone ?? 'UTC',
    locale: currentProfile.data?.locale ?? 'en-US',
    status: currentProfile.data?.status ?? 'active',
    uiThemeKey: currentProfile.data?.ui_theme_key ?? 'teal',
  } as const;

  if (!currentProfile.data || currentProfile.data.kind !== 'child') {
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

  const roleResponse = await upsertUserRole(serviceSupabase, {
    orgId: account.org_id,
    accountId: account.id,
    roleKey: 'child',
    assignedBy: user.id,
  });
  if (roleResponse.error) {
    return NextResponse.json({ success: false, message: roleResponse.error.message }, { status: 500 });
  }

  const usageResponse = await serviceSupabase
    .from('student_access_codes')
    .update({
      uses: inviteCodeRow.uses + 1,
      status: inviteCodeRow.uses + 1 >= inviteCodeRow.max_uses ? 'used' : inviteCodeRow.status,
      updated_at: now,
    })
    .eq('id', inviteCodeRow.id)
    .eq('org_id', account.org_id);
  if (usageResponse.error) {
    return NextResponse.json({ success: false, message: usageResponse.error.message }, { status: 500 });
  }

  const accountRoleResponse = await updateAccountRoleState(serviceSupabase, {
    accountId: account.id,
    orgId: account.org_id,
    primaryRole: 'child',
    roleStatus: 'active',
    onboardingCompletedAt: now,
    updatedBy: user.id,
  });
  if (accountRoleResponse.error || !accountRoleResponse.data) {
    return NextResponse.json(
      {
        success: false,
        message: accountRoleResponse.error?.message ?? 'Unable to update account role',
      },
      { status: 500 },
    );
  }

  const rolesResponse = await getUserRoles(serviceSupabase, account.id, account.org_id);
  if (rolesResponse.error) {
    return NextResponse.json({ success: false, message: rolesResponse.error.message }, { status: 500 });
  }

  const onboarding = buildAuthOnboardingState(
    accountRoleResponse.data,
    rolesResponse.data ?? [],
  );
  if (onboarding.destination === '/login/pending-access') {
    const loginPath = await resolveOrgLoginPath(
      serviceSupabase,
      accountRoleResponse.data.org_id,
    );
    onboarding.destination = `${loginPath}/pending-access`;
  } else if (onboarding.destination === '/dashboard') {
    onboarding.destination = await resolveOrgDashboardPath(
      serviceSupabase,
      accountRoleResponse.data.org_id,
    );
  }

  return NextResponse.json({ success: true, onboarding });
}
