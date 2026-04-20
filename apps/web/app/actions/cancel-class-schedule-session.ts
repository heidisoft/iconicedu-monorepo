'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
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

  const serviceSupabase = createSupabaseServiceClient();
  const timestamp = new Date().toISOString();
  const reason = normalizeReason(input.reason);

  const { data: scheduleRow, error: scheduleError } = await serviceSupabase
    .from('class_schedules')
    .select(
      'id, org_id, source_learning_space_id, source_channel_id, timezone, title, start_at',
    )
    .eq('id', input.scheduleId)
    .eq('org_id', org.id)
    .is('deleted_at', null)
    .maybeSingle<{
      id: string;
      org_id: string;
      source_learning_space_id: string | null;
      source_channel_id: string | null;
      timezone: string | null;
      title: string;
      start_at: string;
    }>();

  if (scheduleError) {
    throw new Error(scheduleError.message);
  }

  if (!scheduleRow) {
    throw new Error('Session not found.');
  }

  const { data: recurrenceRow, error: recurrenceError } = await serviceSupabase
    .from('class_schedule_recurrence')
    .select('id')
    .eq('org_id', org.id)
    .eq('schedule_id', input.scheduleId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string }>();

  if (recurrenceError) {
    throw new Error(recurrenceError.message);
  }

  if (!recurrenceRow) {
    const { error: updateError } = await serviceSupabase
      .from('class_schedules')
      .update({
        status: 'cancelled',
        updated_at: timestamp,
        updated_by: account.id,
      })
      .eq('id', input.scheduleId)
      .eq('org_id', org.id)
      .is('deleted_at', null);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/${input.orgSlug}/class-schedule`);

    return {
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey,
      reason,
      mode: 'single',
    };
  }

  const { error: deleteOverrideError } = await serviceSupabase
    .from('class_schedule_recurrence_overrides')
    .delete()
    .eq('org_id', org.id)
    .eq('recurrence_id', recurrenceRow.id)
    .eq('occurrence_key', input.occurrenceKey);

  if (deleteOverrideError) {
    throw new Error(deleteOverrideError.message);
  }

  const { data: existingException, error: exceptionLookupError } = await serviceSupabase
    .from('class_schedule_recurrence_exceptions')
    .select('id')
    .eq('org_id', org.id)
    .eq('recurrence_id', recurrenceRow.id)
    .eq('occurrence_key', input.occurrenceKey)
    .maybeSingle<{ id: string }>();

  if (exceptionLookupError) {
    throw new Error(exceptionLookupError.message);
  }

  if (existingException) {
    const { error: updateExceptionError } = await serviceSupabase
      .from('class_schedule_recurrence_exceptions')
      .update({
        reason,
        updated_at: timestamp,
        updated_by: account.id,
      })
      .eq('id', existingException.id)
      .eq('org_id', org.id);

    if (updateExceptionError) {
      throw new Error(updateExceptionError.message);
    }
  } else {
    const { error: insertExceptionError } = await serviceSupabase
      .from('class_schedule_recurrence_exceptions')
      .insert({
        id: randomUUID(),
        org_id: org.id,
        recurrence_id: recurrenceRow.id,
        occurrence_key: input.occurrenceKey,
        reason,
        created_at: timestamp,
        created_by: account.id,
        updated_at: timestamp,
        updated_by: account.id,
      });

    if (insertExceptionError) {
      throw new Error(insertExceptionError.message);
    }
  }

  revalidatePath(`/${input.orgSlug}/class-schedule`);

  return {
    scheduleId: input.scheduleId,
    occurrenceKey: input.occurrenceKey,
    reason,
    mode: 'recurring',
  };
}

function normalizeReason(reason?: string | null) {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}
