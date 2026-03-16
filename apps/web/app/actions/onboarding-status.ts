'use server';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { upsertUserOnboardingStatus } from '@iconicedu/web/lib/onboarding/queries/status.query';
import { mapUserOnboardingStatusRowToVM } from '@iconicedu/web/lib/onboarding/mappers';
import type { OnboardingStep, UserOnboardingStatusVM } from '@iconicedu/shared-types';

export type OnboardingStatusUpdateInput = {
  profileId: string;
  orgId: string;
  currentStep: OnboardingStep | null;
  completed: boolean;
  lastCompletedStep?: OnboardingStep | null;
};

export async function upsertUserOnboardingStatusAction(
  input: OnboardingStatusUpdateInput,
): Promise<UserOnboardingStatusVM> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await upsertUserOnboardingStatus(supabase, {
    profileId: input.profileId,
    orgId: input.orgId,
    currentStep: input.currentStep,
    lastCompletedStep: input.lastCompletedStep ?? null,
    completed: input.completed,
  });

  if (error || !data) {
    throw error ?? new Error('Unable to update onboarding status');
  }

  return mapUserOnboardingStatusRowToVM(data);
}
