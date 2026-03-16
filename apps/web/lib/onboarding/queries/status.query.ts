import type { SupabaseClient, PostgrestSingleResponse } from '@supabase/supabase-js';
import type { OnboardingStep, UserOnboardingStatusRow } from '@iconicedu/shared-types';

export interface UpsertUserOnboardingStatusInput {
  profileId: string;
  orgId: string;
  currentStep: OnboardingStep | null;
  lastCompletedStep?: OnboardingStep | null;
  progress?: Record<string, unknown> | null;
  completed?: boolean;
}

export async function getUserOnboardingStatusByProfileId(
  supabase: SupabaseClient,
  profileId: string,
): Promise<PostgrestSingleResponse<UserOnboardingStatusRow | null>> {
  return supabase
    .from('user_onboarding_status')
    .select('*')
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
}

export async function upsertUserOnboardingStatus(
  supabase: SupabaseClient,
  input: UpsertUserOnboardingStatusInput,
): Promise<PostgrestSingleResponse<UserOnboardingStatusRow | null>> {
  return supabase
    .from('user_onboarding_status')
    .upsert(
      {
        profile_id: input.profileId,
        org_id: input.orgId,
        current_step: input.currentStep,
        last_completed_step: input.lastCompletedStep ?? null,
        progress: input.progress ?? null,
        completed: input.completed ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,org_id' },
    )
    .select('*')
    .maybeSingle();
}
