import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';

// GET /schedules returns the raw class_schedules row shape (snake_case, plus
// nested participants/recurrence) — this narrows to just what a classroom
// picker needs rather than importing the full row type.
export type ScheduleOptionRow = {
  id: string;
  title: string;
  status: string;
  timezone: string | null;
};

export function listSchedules(
  supabase: SupabaseClient,
  input: { orgId: string; channelId?: string },
) {
  return createApiClient(supabase).get<ScheduleOptionRow[]>('/schedules', input);
}
