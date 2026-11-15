import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClassScheduleSessionContextVM,
  ClassScheduleVM,
  LearningSpaceEditContextVM,
} from '@iconicedu/shared-types';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

// GET /schedules returns the raw class_schedules row shape (snake_case, plus
// nested participants/recurrence) — this narrows to just what a classroom
// picker needs rather than importing the full row type.
export type ScheduleParticipantOption = {
  profile_id: string;
  role: string;
  display_name: string | null;
};

export type ScheduleOptionRow = {
  id: string;
  title: string;
  status: string;
  timezone: string | null;
  participants?: ScheduleParticipantOption[];
};

export function listSchedules(
  supabase: SupabaseClient,
  input: { orgId: string; channelId?: string },
) {
  return createApiClient(supabase).get<ScheduleOptionRow[]>('/schedules', input);
}

export function getLearningSpaceEditContext(
  supabase: SupabaseClient,
  input: { orgId: string; learningSpaceId: string; channelId: string },
) {
  return createApiClient(supabase).get<LearningSpaceEditContextVM>(
    '/schedules/learning-space/context',
    input,
  );
}

// GET /schedules/calendar returns mapped ClassScheduleVMs across every source_kind
// (class_session/availability_block/manual) — unlike GET /schedules above, which is
// class_session-only raw rows for the picker.
export async function getScheduleCalendar(
  supabase: SupabaseClient,
  input: { orgId: string; scheduleIds?: string[] },
): Promise<ClassScheduleVM[]> {
  // The HTTP client drops empty query params, so `scheduleIds: []` would reach the
  // API as "no filter" and return every schedule in the org. Never send it.
  if (input.scheduleIds && input.scheduleIds.length === 0) {
    return [];
  }

  const schedules = await createApiClient(supabase).get<ClassScheduleVM[] | undefined>(
    '/schedules/calendar',
    { orgId: input.orgId, scheduleIds: input.scheduleIds?.join(',') },
  );
  return Array.isArray(schedules) ? schedules : [];
}

// GET /schedules/session/context — bootstrap for the reschedule/split quick-edit
// actions. The API rejects missing schedules (400 "Schedule not found") and
// archived classrooms (400 "Archived classrooms cannot be changed.").
export function getClassScheduleSessionContext(
  supabase: SupabaseClient,
  input: { orgId: string; scheduleId: string },
) {
  return createApiClient(supabase).get<ClassScheduleSessionContextVM>(
    '/schedules/session/context',
    input,
  );
}
