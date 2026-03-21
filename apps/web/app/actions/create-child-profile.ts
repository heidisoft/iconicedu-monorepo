'use server';

import type {
  AccountRow,
  ChildProfileVM,
  ProfileRow,
  ThemeKey,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getFamilyInviteAdminClient,
  ensureFamilyForGuardian,
} from '@iconicedu/web/lib/family/queries/invite.query';
import { loadChildProfiles } from '@iconicedu/web/lib/profile/builders/load-child-profiles';
import { buildChildDisplayName } from '@iconicedu/web/lib/profile/display-name';
import { requireParentActorContext } from '@iconicedu/web/lib/family-view/actor-context';
import { seedSignupDefaultNotificationPreferences } from '@iconicedu/web/lib/profile/queries/notification-defaults-seed.query';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? null;

type CreationCleanupContext = {
  serviceClient: SupabaseClient;
  orgId: string;
  guardianAccountId: string;
  childAccountId: string;
  accountCreated: boolean;
  profileCreated: boolean;
  profileId: string | null;
  childProfileCreated: boolean;
  childGradeCreated: boolean;
  familyLinkCreated: boolean;
  familyId: string | null;
};

async function cleanupCreatedRecords(context: CreationCleanupContext) {
  const {
    serviceClient,
    orgId,
    guardianAccountId,
    childAccountId,
    accountCreated,
    profileCreated,
    profileId,
    childProfileCreated,
    childGradeCreated,
    familyLinkCreated,
    familyId,
  } = context;

  const run = async (description: string, fn: () => unknown) => {
    try {
      await fn();
    } catch (error) {
      console.error(`cleanup failed (${description})`, error);
    }
  };

  if (childGradeCreated && profileId) {
    await run('child grade', () =>
      serviceClient
        .from('child_profile_grade_level')
        .delete()
        .match({ org_id: orgId, profile_id: profileId }),
    );
  }

  if (childProfileCreated && profileId) {
    await run('child profile', () =>
      serviceClient
        .from('child_profiles')
        .delete()
        .match({ org_id: orgId, profile_id: profileId }),
    );
  }

  if (familyLinkCreated && familyId) {
    await run('family link', () =>
      serviceClient.from('family_links').delete().match({
        org_id: orgId,
        family_id: familyId,
        guardian_account_id: guardianAccountId,
        child_account_id: childAccountId,
      }),
    );
  }

  if (profileCreated && profileId) {
    await run('profile', () =>
      serviceClient.from('profiles').delete().eq('id', profileId),
    );
  }

  if (accountCreated) {
    await run('account', () =>
      serviceClient.from('accounts').delete().eq('id', childAccountId),
    );
  }
}

async function createOrLoadChildAccount(options: {
  serviceClient: SupabaseClient;
  orgId: string;
  email?: string | null;
  createdByAccountId: string;
}): Promise<{ account: AccountRow; created: boolean }> {
  const normalizedEmail = normalizeEmail(options.email);

  if (normalizedEmail) {
    // TODO: revisit invite flow when child account exists with the same email so we don't silently skip needed updates.
    const { data: existingAccount } = await options.serviceClient
      .from('accounts')
      .select('*')
      .eq('org_id', options.orgId)
      .ilike('email', normalizedEmail)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<AccountRow>();

    if (existingAccount) {
      return { account: existingAccount, created: false };
    }
  }

  const { data: childAccount, error: accountError } = await options.serviceClient
    .from('accounts')
    .insert({
      org_id: options.orgId,
      email: normalizedEmail,
      preferred_contact_channels: ['email'],
      status: 'active',
      created_by: options.createdByAccountId,
      updated_by: options.createdByAccountId,
    })
    .select('*')
    .single<AccountRow>();

  if (accountError || !childAccount) {
    throw accountError ?? new Error('Unable to create child account');
  }

  return { account: childAccount, created: true };
}

async function seedDefaultNotificationsIfMissing(input: {
  serviceClient: SupabaseClient;
  orgId: string;
  profileId: string;
}) {
  const existingResponse = await input.serviceClient
    .from('notification_preferences')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('profile_id', input.profileId)
    .is('deleted_at', null)
    .limit(1);

  if (existingResponse.error) {
    throw existingResponse.error;
  }

  if ((existingResponse.data ?? []).length > 0) {
    return;
  }

  const seedResponse = await seedSignupDefaultNotificationPreferences(
    input.serviceClient,
    input.orgId,
    input.profileId,
  );
  if (seedResponse.error) {
    throw seedResponse.error;
  }
}

type CreateChildProfileInput = {
  orgId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  birthYear: number;
  email?: string | null;
  timezone?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  postalCode?: string | null;
  themeKey?: ThemeKey | null;
};

export async function createChildProfileAction(
  input: CreateChildProfileInput,
): Promise<ChildProfileVM> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const actor = await requireParentActorContext(supabase);
  const guardianAccount = actor.account;
  if (input.orgId !== guardianAccount.org_id) {
    throw new Error('Organization mismatch');
  }
  const serviceClient = getFamilyInviteAdminClient();
  const cleanupContext: CreationCleanupContext = {
    serviceClient,
    orgId: guardianAccount.org_id,
    guardianAccountId: guardianAccount.id,
    childAccountId: '',
    accountCreated: false,
    profileCreated: false,
    profileId: null,
    childProfileCreated: false,
    childGradeCreated: false,
    familyLinkCreated: false,
    familyId: null,
  };

  try {
    const { account: childAccount, created: accountCreated } =
      await createOrLoadChildAccount({
        serviceClient,
        orgId: guardianAccount.org_id,
        email: input.email,
        createdByAccountId: guardianAccount.id,
      });
    cleanupContext.childAccountId = childAccount.id;
    cleanupContext.accountCreated = accountCreated;
    const displayNameValue = buildChildDisplayName(input.firstName, input.lastName);

    const profilePayload = {
      org_id: guardianAccount.org_id,
      account_id: childAccount.id,
      kind: 'child',
      display_name: displayNameValue,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      avatar_source: 'seed',
      avatar_url: null,
      avatar_seed: childAccount.id,
      timezone: input.timezone ?? 'UTC',
      locale: 'en-US',
      status: 'active',
      country_code: input.countryCode ?? null,
      country_name: input.countryName ?? null,
      region: input.region ?? null,
      city: input.city ?? null,
      postal_code: input.postalCode ?? null,
      ui_theme_key: input.themeKey ?? null,
      created_by: guardianAccount.id,
      updated_by: guardianAccount.id,
    };

    const { data: existingProfile, error: existingProfileError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('org_id', guardianAccount.org_id)
      .eq('account_id', childAccount.id)
      .maybeSingle();

    if (existingProfileError) {
      throw existingProfileError;
    }

    let profileRow: ProfileRow | null = null;

    if (existingProfile) {
      const { data, error } = await serviceClient
        .from('profiles')
        .update(profilePayload)
        .eq('id', existingProfile.id)
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('Unable to update existing child profile');
      }

      profileRow = data;
    } else {
      const { data, error } = await serviceClient
        .from('profiles')
        .insert(profilePayload)
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('Unable to create child profile');
      }

      profileRow = data;
      cleanupContext.profileCreated = true;
    }

    if (!profileRow) {
      throw new Error('Unable to resolve child profile record');
    }

    cleanupContext.profileId = profileRow.id;

    await seedDefaultNotificationsIfMissing({
      serviceClient,
      orgId: guardianAccount.org_id,
      profileId: profileRow.id,
    });

    const familyId = await ensureFamilyForGuardian({
      supabase: serviceClient,
      guardianAccountId: guardianAccount.id,
      orgId: guardianAccount.org_id,
    });

    cleanupContext.familyId = familyId;

    const { data: existingFamilyLink, error: existingFamilyLinkError } =
      await serviceClient
        .from('family_links')
        .select('id')
        .eq('org_id', guardianAccount.org_id)
        .eq('family_id', familyId)
        .eq('guardian_account_id', guardianAccount.id)
        .eq('child_account_id', childAccount.id)
        .maybeSingle();

    if (existingFamilyLinkError) {
      throw existingFamilyLinkError;
    }

    cleanupContext.familyLinkCreated = !existingFamilyLink;

    const { error: linkError } = await serviceClient.from('family_links').upsert(
      {
        org_id: guardianAccount.org_id,
        family_id: familyId,
        guardian_account_id: guardianAccount.id,
        child_account_id: childAccount.id,
        relation: 'guardian',
        created_by: guardianAccount.id,
        updated_by: guardianAccount.id,
      },
      { onConflict: 'org_id,family_id,guardian_account_id,child_account_id' },
    );

    if (linkError) {
      throw linkError;
    }

    const childProfilePayload = {
      profile_id: profileRow.id,
      org_id: guardianAccount.org_id,
      birth_year: input.birthYear,
      created_by: guardianAccount.id,
      updated_by: guardianAccount.id,
    };

    const { data: existingChildProfile, error: existingChildProfileError } =
      await serviceClient
        .from('child_profiles')
        .select('profile_id')
        .eq('org_id', guardianAccount.org_id)
        .eq('profile_id', profileRow.id)
        .maybeSingle();

    if (existingChildProfileError) {
      throw existingChildProfileError;
    }

    cleanupContext.childProfileCreated = !existingChildProfile;

    if (existingChildProfile) {
      const { error } = await serviceClient
        .from('child_profiles')
        .update(childProfilePayload)
        .match({
          org_id: guardianAccount.org_id,
          profile_id: profileRow.id,
        });

      if (error) {
        throw error;
      }
    } else {
      const { error } = await serviceClient
        .from('child_profiles')
        .insert(childProfilePayload);

      if (error) {
        throw error;
      }
    }

    const childGradePayload = {
      org_id: guardianAccount.org_id,
      profile_id: profileRow.id,
      grade_id: input.gradeLevel,
      grade_label: input.gradeLevel,
      created_by: guardianAccount.id,
      updated_by: guardianAccount.id,
    };

    const { data: existingGrade, error: existingGradeError } = await serviceClient
      .from('child_profile_grade_level')
      .select('id')
      .eq('org_id', guardianAccount.org_id)
      .eq('profile_id', profileRow.id)
      .maybeSingle();

    if (existingGradeError) {
      throw existingGradeError;
    }

    cleanupContext.childGradeCreated = !existingGrade;

    if (existingGrade) {
      const { error } = await serviceClient
        .from('child_profile_grade_level')
        .update(childGradePayload)
        .eq('id', existingGrade.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await serviceClient
        .from('child_profile_grade_level')
        .insert(childGradePayload);

      if (error) {
        throw error;
      }
    }

    const children = await loadChildProfiles(serviceClient, guardianAccount.org_id, [
      childAccount.id,
    ]);

    if (!children.length) {
      throw new Error('Unable to load child profile');
    }

    return children[0];
  } catch (error) {
    await cleanupCreatedRecords(cleanupContext);
    throw error;
  }
}
