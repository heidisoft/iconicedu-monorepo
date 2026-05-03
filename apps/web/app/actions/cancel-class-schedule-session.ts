'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { getAccountByAuthUserIdInOrg } from '@iconicedu/web/lib/accounts/queries/accounts.query';

export type CancelClassScheduleSessionActionInput = {
  orgSlug: string;
  scheduleId: string;
  occurrenceKey: string;
  reason?: string | null;
};

export type CancelClassScheduleSessionActionResult = {
  scheduleId: string;
  occurrenceKey: string;
  reason: string | null;
  mode: 'recurring' | 'single';
};

export async function cancelClassScheduleSessionAction(
  input: CancelClassScheduleSessionActionInput,
): Promise<CancelClassScheduleSessionActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const org = await buildOrgBySlug(supabase, input.orgSlug);
  if (!org) {
    throw new Error('Organization not found');
  }

  const accountResponse = await getAccountByAuthUserIdInOrg(supabase, user.id, org.id);
  const account = accountResponse.data;
  if (!account) {
    throw new Error('Account record not found');
  }

  const canManageSessions =
    account.primary_role === 'staff' || account.primary_role === 'owner';
  if (!canManageSessions) {
    throw new Error('Only staff or owner users can cancel sessions.');
  }

  const reason = normalizeReason(input.reason);
  const api = createApiClient(supabase);

  const result = await api.post<{ mode: 'single' | 'recurring' }>(
    '/schedules/session/cancel',
    {
      orgId: org.id,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey ?? null,
      reason,
    },
  );

  revalidatePath(`/${input.orgSlug}/class-schedule`);

  return {
    scheduleId: input.scheduleId,
    occurrenceKey: input.occurrenceKey,
    reason,
    mode: result.mode,
  };
}

function normalizeReason(reason?: string | null) {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}
