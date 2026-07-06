'use server';

import { revalidatePath } from 'next/cache';
import type {
  ClassScheduleSelfServePolicyVM,
  SelfServeSessionChangeResultVM,
  SessionChangeRequestVM,
} from '@iconicedu/shared-types';
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

export type UpsertSelfServePolicyActionInput = ClassScheduleSelfServePolicyVM & {
  orgSlug: string;
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

export async function listSessionChangeRequestsAction(input: {
  orgSlug: string;
  channelId?: string | null;
  scheduleId?: string | null;
}): Promise<SessionChangeRequestVM[]> {
  const { supabase, orgId } = await getOrgId(input.orgSlug);
  const api = createApiClient(supabase);
  return api.get<SessionChangeRequestVM[]>('/schedules/session/change-requests', {
    orgId,
    channelId: input.channelId ?? undefined,
    scheduleId: input.scheduleId ?? undefined,
  });
}

export async function approveSessionChangeRequestAction(input: {
  orgSlug: string;
  requestId: string;
  note?: string | null;
}): Promise<SelfServeSessionChangeResultVM> {
  const { supabase } = await getOrgId(input.orgSlug);
  const api = createApiClient(supabase);
  const result = await api.post<SelfServeSessionChangeResultVM>(
    `/schedules/session/change-requests/${input.requestId}/approve`,
    { note: input.note ?? null },
  );
  revalidatePath(`/${input.orgSlug}/class-schedule`);
  return result;
}

export async function rejectSessionChangeRequestAction(input: {
  orgSlug: string;
  requestId: string;
  note?: string | null;
}): Promise<SelfServeSessionChangeResultVM> {
  const { supabase } = await getOrgId(input.orgSlug);
  const api = createApiClient(supabase);
  const result = await api.post<SelfServeSessionChangeResultVM>(
    `/schedules/session/change-requests/${input.requestId}/reject`,
    { note: input.note ?? null },
  );
  revalidatePath(`/${input.orgSlug}/class-schedule`);
  return result;
}

export async function listSelfServePoliciesAction(input: {
  orgSlug: string;
}): Promise<Array<ClassScheduleSelfServePolicyVM & { title: string | null }>> {
  const { supabase, orgId } = await getOrgId(input.orgSlug);
  const api = createApiClient(supabase);
  return api.get<Array<ClassScheduleSelfServePolicyVM & { title: string | null }>>(
    '/schedules/session/self-serve/policies',
    { orgId },
  );
}

export async function upsertSelfServePolicyAction(
  input: UpsertSelfServePolicyActionInput,
): Promise<ClassScheduleSelfServePolicyVM> {
  const { supabase } = await getOrgId(input.orgSlug);
  const api = createApiClient(supabase);
  const result = await api.post<ClassScheduleSelfServePolicyVM>(
    '/schedules/session/self-serve/policies',
    {
      orgId: input.orgId,
      learningSpaceId: input.learningSpaceId,
      enabled: input.enabled,
      cutoffHours: input.cutoffHours,
      allowGuardian: input.allowGuardian,
      allowEducator: input.allowEducator,
      allowChild: input.allowChild,
      withinCutoffRequiresApproval: input.withinCutoffRequiresApproval,
    },
  );
  revalidatePath(`/${input.orgSlug}/admin/settings/session-changes`);
  return result;
}
