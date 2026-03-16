'use server';

import type { DayAvailability, EducatorAvailabilityVM } from '@iconicedu/shared-types';

import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { upsertEducatorAvailability } from '@iconicedu/web/lib/profile/queries/educator.query';

export type SaveEducatorAvailabilityActionInput = {
  profileId: string;
  orgId: string;
  classTypes?: string[] | null;
  weeklyCommitment?: number | null;
  availability?: DayAvailability | null;
};

export async function saveEducatorAvailabilityAction(
  input: SaveEducatorAvailabilityActionInput,
): Promise<EducatorAvailabilityVM> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const accountResponse = await getAccountByAuthUserId(supabase, user.id);
  if (!accountResponse.data) {
    throw new Error('Account record not found');
  }

  if (accountResponse.data.org_id !== input.orgId) {
    throw new Error('Organization mismatch');
  }

  const { data: availabilityRow, error } = await upsertEducatorAvailability(supabase, {
    profileId: input.profileId,
    orgId: input.orgId,
    classTypes: input.classTypes ?? null,
    weeklyCommitment: input.weeklyCommitment ?? null,
    availability: input.availability ?? null,
    createdBy: accountResponse.data.id,
    updatedBy: accountResponse.data.id,
  });

  if (error) {
    throw error;
  }

  if (!availabilityRow) {
    throw new Error('Unable to persist educator availability.');
  }

  return {
    classTypes: availabilityRow.class_types ?? null,
    weeklyCommitment: availabilityRow.weekly_commitment ?? null,
    availability: availabilityRow.availability ?? null,
  };
}
