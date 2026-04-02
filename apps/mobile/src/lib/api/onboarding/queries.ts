import { supabase } from '@/lib/supabase/client';
import type { DayAvailability, OnboardingStatus } from '@/lib/api/types';

const MOBILE_ALLOWED_ROLES = new Set([
  'educator',
  'guardian',
  'child',
  'staff',
  'admin',
  'system',
]);

export function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            'Account lookup timed out. Please check your connection and try again.',
          ),
        ),
      12_000,
    ),
  );
  return Promise.race([doFetchOnboardingStatus(), timeout]);
}

async function doFetchOnboardingStatus(): Promise<OnboardingStatus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: accountByAuthId, error: accountError } = await supabase
    .from('accounts')
    .select('id, org_id, onboarding_completed_at, primary_role, phone_e164')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (accountError) throw accountError;

  let account = accountByAuthId;

  if (!account && user.email) {
    const { data: accountByEmail } = await supabase
      .from('accounts')
      .select('id, org_id, onboarding_completed_at, primary_role, phone_e164')
      .eq('email', user.email.trim().toLowerCase())
      .maybeSingle();

    if (accountByEmail) {
      await supabase
        .from('accounts')
        .update({ auth_user_id: user.id })
        .eq('id', accountByEmail.id);
      account = accountByEmail;
    }
  }

  if (!account) {
    throw new Error('No account found for this user. Please contact your administrator.');
  }

  let profileId: string | null = null;
  let profileKind: string | null = null;
  let firstName = '';
  let lastName = '';
  let timezone = '';
  let city = '';
  let region = '';
  let postalCode = '';
  let countryCode = '';

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, kind, first_name, last_name, timezone, city, region, postal_code, country_code',
    )
    .eq('account_id', account.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (profile) {
    profileId = profile.id;
    profileKind = profile.kind ?? null;
    firstName = profile.first_name ?? '';
    lastName = profile.last_name ?? '';
    timezone = profile.timezone ?? '';
    city = ((profile as Record<string, unknown>).city as string) ?? '';
    region = ((profile as Record<string, unknown>).region as string) ?? '';
    postalCode = ((profile as Record<string, unknown>).postal_code as string) ?? '';
    countryCode = ((profile as Record<string, unknown>).country_code as string) ?? '';
  }

  const kind = profileKind ?? account.primary_role ?? null;
  const hasName = !!firstName.trim() && !!lastName.trim();
  const hasTimezone = !!timezone.trim() && timezone.trim() !== 'UTC';
  const hasLocation = !!city.trim() && !!region.trim();
  const requiresPhone = kind !== 'child';
  const hasPhone = !!account.phone_e164?.trim();

  let hasRoleData = true;
  if (kind === 'child' && profileId) {
    const { data: gradeRows } = await supabase
      .from('child_profile_grade_level')
      .select('grade_id')
      .eq('profile_id', profileId)
      .limit(1);
    hasRoleData = (gradeRows?.length ?? 0) > 0;
  } else if (kind === 'educator' && profileId) {
    const [{ data: subjectRows }, { data: gradeRows }] = await Promise.all([
      supabase
        .from('educator_profile_subjects')
        .select('subject')
        .eq('profile_id', profileId)
        .limit(1),
      supabase
        .from('educator_profile_grade_levels')
        .select('grade_id')
        .eq('profile_id', profileId)
        .limit(1),
    ]);
    hasRoleData = (subjectRows?.length ?? 0) > 0 && (gradeRows?.length ?? 0) > 0;
  }

  let hasAvailability = kind !== 'educator';
  if (kind === 'educator' && profileId) {
    const { data: availRows } = await supabase
      .from('educator_availabilities')
      .select('profile_id')
      .eq('profile_id', profileId)
      .limit(1);
    hasAvailability = (availRows?.length ?? 0) > 0;
  }

  const isComplete =
    hasName &&
    hasTimezone &&
    hasLocation &&
    (!requiresPhone || hasPhone) &&
    hasRoleData &&
    hasAvailability;

  return {
    isComplete,
    isRoleAllowed: kind === null || MOBILE_ALLOWED_ROLES.has(kind),
    profileId,
    accountId: account.id,
    orgId: account.org_id,
    primaryRole: account.primary_role ?? null,
    profileKind,
    flags: {
      hasName,
      hasTimezone,
      hasLocation,
      hasPhone,
      requiresPhone,
      hasRoleData,
      hasAvailability,
    },
    prefill: {
      firstName,
      lastName,
      phone: account.phone_e164 ?? '',
      timezone,
      city,
      region,
      postalCode,
      countryCode,
    },
  };
}

export async function saveNameStep(
  profileId: string,
  firstName: string,
  lastName: string,
) {
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: displayName,
    })
    .eq('id', profileId);
  if (error) throw error;
}

export async function savePhoneStep(accountId: string, phone: string) {
  const { error } = await supabase
    .from('accounts')
    .update({ phone_e164: phone.trim() || null })
    .eq('id', accountId);
  if (error) throw error;
}

export async function saveTimezoneStep(profileId: string, timezone: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', profileId);
  if (error) throw error;
}

export async function saveStudentStep(
  profileId: string,
  orgId: string,
  birthYear: number | null,
  gradeLevel: string | null,
) {
  const { error: profileError } = await supabase
    .from('child_profiles')
    .upsert(
      { profile_id: profileId, org_id: orgId, birth_year: birthYear },
      { onConflict: 'profile_id' },
    );
  if (profileError) throw profileError;

  if (gradeLevel) {
    await supabase.from('child_profile_grade_level').delete().eq('profile_id', profileId);
    const { error: gradeError } = await supabase
      .from('child_profile_grade_level')
      .insert({ profile_id: profileId, org_id: orgId, grade_id: gradeLevel });
    if (gradeError) throw gradeError;
  }
}

export async function saveLocationStep(
  profileId: string,
  city: string,
  region: string,
  postalCode: string,
  countryCode: string,
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      city: city.trim() || null,
      region: region.trim() || null,
      postal_code: postalCode.trim() || null,
      country_code: countryCode || null,
    } as Record<string, unknown>)
    .eq('id', profileId);
  if (error) throw error;
}

export async function saveEducatorProfileStep(
  profileId: string,
  orgId: string,
  subjects: string[],
  gradeLevels: string[],
) {
  await supabase.from('educator_profile_subjects').delete().eq('profile_id', profileId);
  if (subjects.length > 0) {
    const subjectRows = subjects.map((subject) => ({
      profile_id: profileId,
      org_id: orgId,
      subject,
    }));
    const { error } = await supabase
      .from('educator_profile_subjects')
      .insert(subjectRows);
    if (error) throw error;
  }

  await supabase
    .from('educator_profile_grade_levels')
    .delete()
    .eq('profile_id', profileId);
  if (gradeLevels.length > 0) {
    const gradeRows = gradeLevels.map((grade_id) => ({
      profile_id: profileId,
      org_id: orgId,
      grade_id,
    }));
    const { error } = await supabase
      .from('educator_profile_grade_levels')
      .insert(gradeRows);
    if (error) throw error;
  }
}

export async function saveEducatorAvailabilityStep(
  profileId: string,
  orgId: string,
  classTypes: string[],
  weeklyCommitment: number | null,
  availability: DayAvailability,
) {
  const { error } = await supabase.from('educator_availabilities').upsert(
    {
      profile_id: profileId,
      org_id: orgId,
      class_types: classTypes,
      weekly_commitment: weeklyCommitment,
      availability,
    },
    { onConflict: 'profile_id' },
  );
  if (error) throw error;
}

export async function completeOnboarding(accountId: string) {
  const { error } = await supabase
    .from('accounts')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', accountId)
    .is('onboarding_completed_at', null);
  if (error) throw error;
}
