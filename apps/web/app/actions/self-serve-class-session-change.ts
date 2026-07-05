'use server';

import { revalidatePath } from 'next/cache';
import type { SelfServeSessionChangeResultVM } from '@iconicedu/shared-types';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { toOccurrenceKeyInTimezone } from '@iconicedu/web/lib/admin/learning-space-schedule-hash';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export type SelfServeCancelClassSessionInput = {
  orgSlug: string;
  scheduleId: string;
  occurrenceKey: string | null;
  note?: string | null;
};

export type SelfServeRescheduleClassSessionInput = SelfServeCancelClassSessionInput & {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

async function getOrgId(orgSlug: string) {
  const supabase = await createSupabaseServerClient();
  const org = await buildOrgBySlug(supabase, orgSlug);
  if (!org) throw new Error('Organization not found');
  return { supabase, orgId: org.id };
}

export async function selfServeCancelClassSessionAction(
  input: SelfServeCancelClassSessionInput,
): Promise<SelfServeSessionChangeResultVM> {
  const { supabase, orgId } = await getOrgId(input.orgSlug);
  const api = createApiClient(supabase);
  const result = await api.post<SelfServeSessionChangeResultVM>(
    '/schedules/session/self-serve/cancel',
    {
      orgId,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey,
      note: input.note,
    },
  );
  revalidatePath(`/${input.orgSlug}/class-schedule`);
  return result;
}

export async function selfServeRescheduleClassSessionAction(
  input: SelfServeRescheduleClassSessionInput,
): Promise<SelfServeSessionChangeResultVM> {
  const { supabase, orgId } = await getOrgId(input.orgSlug);
  const api = createApiClient(supabase);
  const startAt = toOccurrenceKeyInTimezone(input.date, input.startTime, input.timezone);
  const endAt = toOccurrenceKeyInTimezone(input.date, input.endTime, input.timezone);
  const result = await api.post<SelfServeSessionChangeResultVM>(
    '/schedules/session/self-serve/reschedule',
    {
      orgId,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey,
      startAt,
      endAt,
      timezone: input.timezone,
      note: input.note,
    },
  );
  revalidatePath(`/${input.orgSlug}/class-schedule`);
  return result;
}
