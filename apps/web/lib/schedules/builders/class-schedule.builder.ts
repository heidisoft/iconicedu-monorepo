import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import { getScheduleCalendar } from '@iconicedu/web/lib/api/schedules';

export async function buildClassSchedulesByOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ClassScheduleVM[]> {
  return getScheduleCalendar(supabase, { orgId });
}

export async function buildClassSchedulesByIds(
  supabase: SupabaseClient,
  orgId: string,
  scheduleIds: string[],
): Promise<ClassScheduleVM[]> {
  if (!scheduleIds.length) {
    return [];
  }

  return getScheduleCalendar(supabase, { orgId, scheduleIds });
}

export async function buildClassScheduleById(
  supabase: SupabaseClient,
  orgId: string,
  scheduleId: string,
): Promise<ClassScheduleVM | null> {
  const schedules = await buildClassSchedulesByIds(supabase, orgId, [scheduleId]);

  return schedules[0] ?? null;
}
