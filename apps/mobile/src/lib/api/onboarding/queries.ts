import { supabase } from '@/lib/supabase/client';
import { apiGet } from '@/lib/api/http-client';
import type { DayAvailability, OnboardingStatus } from '@/lib/api/types';

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
  return apiGet<OnboardingStatus>('/onboarding/status');
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
