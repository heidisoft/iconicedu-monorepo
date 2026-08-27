import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClassScheduleRow,
  ClassScheduleParticipantRow,
  ClassScheduleRecurrenceRow,
  ClassScheduleRecurrenceExceptionRow,
  ClassScheduleRecurrenceOverrideRow,
} from '@iconicedu/shared-types';

import {
  CLASS_SCHEDULE_SELECT,
  CLASS_SCHEDULE_PARTICIPANT_SELECT,
  CLASS_SCHEDULE_RECURRENCE_SELECT,
  CLASS_SCHEDULE_RECURRENCE_EXCEPTION_SELECT,
  CLASS_SCHEDULE_RECURRENCE_OVERRIDE_SELECT,
} from '@iconicedu/api/lib/schedules/selects';

export async function getClassSchedulesByOrg(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from('class_schedules')
    .select(CLASS_SCHEDULE_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('start_at', { ascending: true })
    .returns<ClassScheduleRow[]>();
}

export async function getClassSchedulesByIds(
  supabase: SupabaseClient,
  orgId: string,
  scheduleIds: string[],
) {
  if (!scheduleIds.length) {
    return { data: [] as ClassScheduleRow[] };
  }

  return supabase
    .from('class_schedules')
    .select(CLASS_SCHEDULE_SELECT)
    .eq('org_id', orgId)
    .in('id', scheduleIds)
    .is('deleted_at', null)
    .order('start_at', { ascending: true })
    .returns<ClassScheduleRow[]>();
}

export async function getClassScheduleParticipantsByScheduleIds(
  supabase: SupabaseClient,
  orgId: string,
  scheduleIds: string[],
) {
  if (!scheduleIds.length) {
    return { data: [] as ClassScheduleParticipantRow[] };
  }

  return supabase
    .from('class_schedule_participants')
    .select(CLASS_SCHEDULE_PARTICIPANT_SELECT)
    .eq('org_id', orgId)
    .in('schedule_id', scheduleIds)
    .returns<ClassScheduleParticipantRow[]>();
}

export async function getClassScheduleRecurrencesByScheduleIds(
  supabase: SupabaseClient,
  orgId: string,
  scheduleIds: string[],
) {
  if (!scheduleIds.length) {
    return { data: [] as ClassScheduleRecurrenceRow[] };
  }

  return supabase
    .from('class_schedule_recurrence')
    .select(CLASS_SCHEDULE_RECURRENCE_SELECT)
    .eq('org_id', orgId)
    .in('schedule_id', scheduleIds)
    .is('deleted_at', null)
    .returns<ClassScheduleRecurrenceRow[]>();
}

export async function getClassScheduleRecurrenceExceptionsByRecurrenceIds(
  supabase: SupabaseClient,
  orgId: string,
  recurrenceIds: string[],
) {
  if (!recurrenceIds.length) {
    return { data: [] as ClassScheduleRecurrenceExceptionRow[] };
  }

  return supabase
    .from('class_schedule_recurrence_exceptions')
    .select(CLASS_SCHEDULE_RECURRENCE_EXCEPTION_SELECT)
    .eq('org_id', orgId)
    .in('recurrence_id', recurrenceIds)
    .returns<ClassScheduleRecurrenceExceptionRow[]>();
}

export async function getClassScheduleRecurrenceOverridesByRecurrenceIds(
  supabase: SupabaseClient,
  orgId: string,
  recurrenceIds: string[],
) {
  if (!recurrenceIds.length) {
    return { data: [] as ClassScheduleRecurrenceOverrideRow[] };
  }

  return supabase
    .from('class_schedule_recurrence_overrides')
    .select(CLASS_SCHEDULE_RECURRENCE_OVERRIDE_SELECT)
    .eq('org_id', orgId)
    .in('recurrence_id', recurrenceIds)
    .returns<ClassScheduleRecurrenceOverrideRow[]>();
}
