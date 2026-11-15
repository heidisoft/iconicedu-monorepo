import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClassScheduleVM } from '@iconicedu/shared-types';

import { getScheduleCalendar } from '@iconicedu/web/lib/api/schedules';

// Schedule reads go through apps/api (GET /schedules/calendar), which maps rows to
// ClassScheduleVMs with the shared @iconicedu/live-sessions-core builder. apps/web
// must not query the class_schedule* tables directly — see
// scripts/check-frontend-table-access.mjs.
//
// Failures degrade to "no schedules" rather than throwing: this matches what the
// calendar page, channel-schedules route, and learning-space page got when these
// reads were direct Supabase queries (`data ?? []`), so an API hiccup cannot turn
// those pages into 500s. The API logs the underlying error server-side.

export async function buildClassSchedulesByOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ClassScheduleVM[]> {
  try {
    return await getScheduleCalendar(supabase, { orgId });
  } catch {
    return [];
  }
}

export async function buildClassSchedulesByIds(
  supabase: SupabaseClient,
  orgId: string,
  scheduleIds: string[],
): Promise<ClassScheduleVM[]> {
  if (!scheduleIds.length) {
    return [];
  }

  try {
    return await getScheduleCalendar(supabase, { orgId, scheduleIds });
  } catch {
    return [];
  }
}

export async function buildClassScheduleById(
  supabase: SupabaseClient,
  orgId: string,
  scheduleId: string,
): Promise<ClassScheduleVM | null> {
  const schedules = await buildClassSchedulesByIds(supabase, orgId, [scheduleId]);

  return schedules[0] ?? null;
}
