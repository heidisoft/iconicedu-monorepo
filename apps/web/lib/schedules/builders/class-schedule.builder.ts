import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClassScheduleParticipantRow,
  ClassScheduleRecurrenceExceptionRow,
  ClassScheduleRecurrenceOverrideRow,
  ClassScheduleRecurrenceRow,
  ClassScheduleRow,
  ClassScheduleVM,
  RecurrenceVM,
} from '@iconicedu/shared-types';

import {
  mapClassScheduleParticipantRow,
  mapClassScheduleRecurrenceRow,
  mapClassScheduleRow,
} from '@iconicedu/web/lib/schedules/mappers/class-schedule.mapper';
import {
  getClassScheduleParticipantsByScheduleIds,
  getClassScheduleRecurrenceExceptionsByRecurrenceIds,
  getClassScheduleRecurrenceOverridesByRecurrenceIds,
  getClassScheduleRecurrencesByScheduleIds,
  getClassSchedulesByIds,
  getClassSchedulesByOrg,
} from '@iconicedu/web/lib/schedules/queries/class-schedule.query';

export async function buildClassSchedulesByOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ClassScheduleVM[]> {
  const schedulesResponse = await getClassSchedulesByOrg(supabase, orgId);
  const scheduleRows = schedulesResponse.data ?? [];

  return buildClassSchedulesFromRows(supabase, orgId, scheduleRows);
}

export async function buildClassSchedulesByIds(
  supabase: SupabaseClient,
  orgId: string,
  scheduleIds: string[],
): Promise<ClassScheduleVM[]> {
  const schedulesResponse = await getClassSchedulesByIds(supabase, orgId, scheduleIds);
  const scheduleRows = schedulesResponse.data ?? [];

  return buildClassSchedulesFromRows(supabase, orgId, scheduleRows);
}

export async function buildClassScheduleById(
  supabase: SupabaseClient,
  orgId: string,
  scheduleId: string,
): Promise<ClassScheduleVM | null> {
  const schedules = await buildClassSchedulesByIds(supabase, orgId, [scheduleId]);

  return schedules[0] ?? null;
}

async function buildClassSchedulesFromRows(
  supabase: SupabaseClient,
  orgId: string,
  scheduleRows: ClassScheduleRow[],
): Promise<ClassScheduleVM[]> {
  if (!scheduleRows.length) {
    return [];
  }

  const scheduleIds = scheduleRows.map((row) => row.id);
  const [participantsResponse, recurrencesResponse] = await Promise.all([
    getClassScheduleParticipantsByScheduleIds(supabase, orgId, scheduleIds),
    getClassScheduleRecurrencesByScheduleIds(supabase, orgId, scheduleIds),
  ]);

  const participantsBySchedule = groupParticipantsBySchedule(
    participantsResponse.data ?? [],
  );
  const recurrencesBySchedule = await loadRecurrencesBySchedule(
    supabase,
    orgId,
    recurrencesResponse.data ?? [],
  );

  return scheduleRows.map((row) =>
    mapClassScheduleRow(row, {
      participants: participantsBySchedule.get(row.id) ?? [],
      recurrence: recurrencesBySchedule.get(row.id) ?? null,
    }),
  );
}

function groupParticipantsBySchedule(
  rows: ClassScheduleParticipantRow[],
): Map<string, ReturnType<typeof mapClassScheduleParticipantRow>[]> {
  const participantsBySchedule = new Map<
    string,
    ReturnType<typeof mapClassScheduleParticipantRow>[]
  >();

  rows.forEach((row) => {
    const scheduleId = row.schedule_id;
    const list = participantsBySchedule.get(scheduleId) ?? [];
    list.push(mapClassScheduleParticipantRow(row));
    participantsBySchedule.set(scheduleId, list);
  });

  return participantsBySchedule;
}

async function loadRecurrencesBySchedule(
  supabase: SupabaseClient,
  orgId: string,
  recurrenceRows: ClassScheduleRecurrenceRow[],
): Promise<Map<string, RecurrenceVM>> {
  if (!recurrenceRows.length) {
    return new Map();
  }

  const recurrenceIds = recurrenceRows.map((row) => row.id);
  const [exceptionsResponse, overridesResponse] = await Promise.all([
    getClassScheduleRecurrenceExceptionsByRecurrenceIds(supabase, orgId, recurrenceIds),
    getClassScheduleRecurrenceOverridesByRecurrenceIds(supabase, orgId, recurrenceIds),
  ]);

  const exceptionsByRecurrence = groupRecurrenceExceptions(exceptionsResponse.data ?? []);
  const overridesByRecurrence = groupRecurrenceOverrides(overridesResponse.data ?? []);

  const recurrencesBySchedule = new Map<string, RecurrenceVM>();
  recurrenceRows.forEach((row) => {
    const recurrence = mapClassScheduleRecurrenceRow(row, {
      exceptions: exceptionsByRecurrence.get(row.id),
      overrides: overridesByRecurrence.get(row.id),
    });
    if (!recurrencesBySchedule.has(row.schedule_id)) {
      recurrencesBySchedule.set(row.schedule_id, recurrence);
    }
  });

  return recurrencesBySchedule;
}

function groupRecurrenceExceptions(
  rows: ClassScheduleRecurrenceExceptionRow[],
): Map<string, ClassScheduleRecurrenceExceptionRow[]> {
  const grouped = new Map<string, ClassScheduleRecurrenceExceptionRow[]>();
  rows.forEach((row) => {
    const list = grouped.get(row.recurrence_id) ?? [];
    list.push(row);
    grouped.set(row.recurrence_id, list);
  });
  return grouped;
}

function groupRecurrenceOverrides(
  rows: ClassScheduleRecurrenceOverrideRow[],
): Map<string, ClassScheduleRecurrenceOverrideRow[]> {
  const grouped = new Map<string, ClassScheduleRecurrenceOverrideRow[]>();
  rows.forEach((row) => {
    const list = grouped.get(row.recurrence_id) ?? [];
    list.push(row);
    grouped.set(row.recurrence_id, list);
  });
  return grouped;
}
