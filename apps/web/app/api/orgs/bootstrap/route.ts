import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import {
  getUserRoles,
  upsertUserRole,
} from '@iconicedu/web/lib/profile/queries/roles.query';
import {
  getProfileByAccountId,
  insertProfileForAccount,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { seedSignupDefaultNotificationPreferences } from '@iconicedu/web/lib/profile/queries/notification-defaults-seed.query';
import { updateAccountRoleState } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { buildAuthOnboardingState } from '@iconicedu/web/lib/onboarding/auth-state';
import { getOrgBySlug } from '@iconicedu/web/lib/org/queries/org.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { ORG_SLUG_REGEX } from '@iconicedu/web/lib/org/slug';
import { seedDefaultOrgSubjectCatalog } from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';
import { ensureSupportChannel } from '@iconicedu/web/lib/channels/actions/ensure-support-channel';

type BootstrapRequestBody = {
  name?: unknown;
  slug?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as BootstrapRequestBody | null;
  const orgName = typeof body?.name === 'string' ? body.name.trim() : '';
  const orgSlugRaw = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const orgSlug = orgSlugRaw.toLowerCase();

  if (!orgName) {
    return NextResponse.json(
      { success: false, message: 'Organization name is required' },
      { status: 400 },
    );
  }

  if (!ORG_SLUG_REGEX.test(orgSlug)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Slug must use lowercase letters, numbers, and hyphens only.',
      },
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
  const existingSlug = await getOrgBySlug(serviceSupabase, orgSlug);
  if (existingSlug.error) {
    return NextResponse.json(
      { success: false, message: existingSlug.error.message },
      { status: 500 },
    );
  }
  if (existingSlug.data) {
    return NextResponse.json(
      { success: false, message: 'Slug is already in use.' },
      { status: 409 },
    );
  }

  const { data: org, error: orgInsertError } = await serviceSupabase
    .from('orgs')
    .insert({
      name: orgName,
      slug: orgSlug,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id, name, slug')
    .single<{ id: string; name: string; slug: string }>();

  if (orgInsertError || !org) {
    return NextResponse.json(
      {
        success: false,
        message: orgInsertError?.message ?? 'Unable to create organization.',
      },
      { status: 500 },
    );
  }

  const { account } = await getOrCreateAccount(serviceSupabase, {
    orgId: org.id,
    authUserId: user.id,
    authEmail: user.email ?? null,
  });

  const roleResponse = await upsertUserRole(serviceSupabase, {
    orgId: org.id,
    accountId: account.id,
    roleKey: 'owner',
    assignedBy: user.id,
  });
  if (roleResponse.error) {
    return NextResponse.json(
      { success: false, message: roleResponse.error.message },
      { status: 500 },
    );
  }

  const profileResponse = await getProfileByAccountId(serviceSupabase, account.id);
  if (profileResponse.error) {
    return NextResponse.json(
      { success: false, message: profileResponse.error.message },
      { status: 500 },
    );
  }

  let creatorProfile = profileResponse.data;
  if (!creatorProfile) {
    const insertProfileResponse = await insertProfileForAccount(serviceSupabase, {
      orgId: org.id,
      accountId: account.id,
      kind: 'staff',
      displayName: null,
      avatarSource: 'seed',
      avatarUrl: null,
      avatarSeed: account.id,
      timezone: 'UTC',
      locale: 'en-US',
      status: 'active',
      uiThemeKey: 'teal',
    });

    if (insertProfileResponse.error || !insertProfileResponse.data) {
      return NextResponse.json(
        {
          success: false,
          message: insertProfileResponse.error?.message ?? 'Unable to create profile.',
        },
        { status: 500 },
      );
    }

    creatorProfile = insertProfileResponse.data;
  }

  await seedSignupDefaultNotificationPreferences(
    serviceSupabase,
    org.id,
    creatorProfile.id,
  );

  const subjectSeedResponse = await seedDefaultOrgSubjectCatalog({
    supabase: serviceSupabase,
    orgId: org.id,
    actorId: creatorProfile.id,
  });
  if (subjectSeedResponse.error) {
    return NextResponse.json(
      { success: false, message: subjectSeedResponse.error.message },
      { status: 500 },
    );
  }

  try {
    await ensureSupportChannel({
      supabase: serviceSupabase,
      orgId: org.id,
      creatorProfileId: creatorProfile.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unable to create support channel.',
      },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();
  const accountRoleStateResponse = await updateAccountRoleState(serviceSupabase, {
    accountId: account.id,
    orgId: org.id,
    primaryRole: 'owner',
    roleStatus: 'active',
    onboardingCompletedAt: now,
    updatedBy: user.id,
  });

  if (accountRoleStateResponse.error || !accountRoleStateResponse.data) {
    return NextResponse.json(
      {
        success: false,
        message:
          accountRoleStateResponse.error?.message ?? 'Unable to update account role.',
      },
      { status: 500 },
    );
  }

  const rolesResponse = await getUserRoles(serviceSupabase, account.id, org.id);
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

  if (onboarding.destination === '/dashboard') {
    onboarding.destination = await resolveOrgDashboardPath(serviceSupabase, org.id);
  }

  return NextResponse.json({
    success: true,
    org,
    onboarding,
  });
}
