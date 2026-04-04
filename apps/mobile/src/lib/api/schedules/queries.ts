import type {
  ClassScheduleVM,
  EventSourceVM,
  RecurrenceVM,
  ClassScheduleParticipantVM,
  RecurrenceFrequencyVM,
  ParticipantRoleVM,
  ParticipationStatusVM,
  EventStatusVM,
  ClassScheduleVisibilityVM,
  ClassSchedulePatchVM,
  ThemeKey,
} from '@iconicedu/shared-types';
import { supabase } from '@/lib/supabase/client';

export type CancelRecurringSessionOccurrenceInput = {
  orgId: string;
  recurrenceId: string;
  occurrenceKey: string;
  reason?: string | null;
};

export type CancelRecurringSessionOccurrenceResult = {
  occurrenceKey: string;
  reason?: string;
};

function mapClassScheduleRow(row: Record<string, unknown>): ClassScheduleVM {
  const orgId = row.org_id as string;
  const recurrenceRows = row.recurrence as Record<string, unknown>[] | null;
  const recurrenceRow = recurrenceRows?.[0];
  const recurrence: RecurrenceVM | undefined = recurrenceRow
    ? {
        ids: { id: recurrenceRow.id as string, orgId },
        rule: {
          frequency: recurrenceRow.frequency as RecurrenceFrequencyVM,
          interval: (recurrenceRow.interval as number | null) ?? undefined,
          byWeekday:
            (recurrenceRow.byday as
              | string[]
              | null as RecurrenceVM['rule']['byWeekday']) ?? undefined,
          count: (recurrenceRow.count as number | null) ?? undefined,
          until: (recurrenceRow.until as string | null) ?? undefined,
          timezone: (recurrenceRow.timezone as string | null) ?? undefined,
        },
        exceptions: ((recurrenceRow.exceptions as Record<string, unknown>[]) ?? []).map(
          (exception) => ({
            occurrenceKey: exception.occurrence_key as string,
            reason: (exception.reason as string | null) ?? undefined,
          }),
        ),
        overrides: ((recurrenceRow.overrides as Record<string, unknown>[]) ?? []).map(
          (override) => ({
            occurrenceKey: override.occurrence_key as string,
            patch: override.patch as ClassSchedulePatchVM,
          }),
        ),
      }
    : undefined;

  let source: EventSourceVM;
  const sourceKind = row.source_kind as string;
  if (sourceKind === 'class_session') {
    source = {
      kind: 'class_session',
      learningSpaceId: row.source_learning_space_id as string,
      channelId: (row.source_channel_id as string | null) ?? undefined,
      sessionId: (row.source_session_id as string | null) ?? undefined,
    };
  } else if (sourceKind === 'availability_block') {
    source = {
      kind: 'availability_block',
      ownerUserId: row.source_owner_user_id as string,
    };
  } else {
    source = {
      kind: 'manual',
      createdByUserId: row.source_created_by_user_id as string,
      relatedTo: row.source_related_learning_space_id
        ? { kind: 'learning_space', id: row.source_related_learning_space_id as string }
        : undefined,
    };
  }

  const participants: ClassScheduleParticipantVM[] = (
    (row.participants as Record<string, unknown>[]) ?? []
  ).map((participant) => ({
    ids: { id: participant.profile_id as string, orgId },
    role: participant.role as ParticipantRoleVM,
    status: (participant.status as ParticipationStatusVM | null) ?? undefined,
    displayName: (participant.display_name as string | null) ?? undefined,
    avatarUrl: (participant.avatar_url as string | null) ?? undefined,
    themeKey: (participant.theme_key as ThemeKey | null) ?? undefined,
  }));

  return {
    ids: { id: row.id as string, orgId },
    title: row.title as string,
    description: (row.description as string | null) ?? undefined,
    location: (row.location as string | null) ?? undefined,
    meetingLink: (row.meeting_link as string | null) ?? undefined,
    startAt: row.start_at as string,
    endAt: row.end_at as string,
    timezone: (row.timezone as string | null) ?? undefined,
    status: row.status as EventStatusVM,
    visibility: row.visibility as ClassScheduleVisibilityVM,
    themeKey: (row.theme_key as ThemeKey | null) ?? undefined,
    participants,
    source,
    recurrence,
    audit: {
      createdAt: row.created_at as string,
      createdBy: row.created_by as string,
      updatedAt: (row.updated_at as string | null) ?? undefined,
      updatedBy: (row.updated_by as string | null) ?? undefined,
    },
  };
}

const CLASS_SCHEDULE_SELECT = `
  id, org_id, title, description, location, meeting_link,
  start_at, end_at, timezone, status, visibility, theme_key,
  source_kind, source_learning_space_id, source_channel_id,
  source_session_id, source_owner_user_id, source_created_by_user_id,
  source_related_learning_space_id,
  created_at, created_by, updated_at, updated_by,
  participants:class_schedule_participants(
    id, org_id, profile_id, role, status, display_name, avatar_url, theme_key
  ),
  recurrence:class_schedule_recurrence(
    id, org_id, frequency, interval, count, until, timezone, byday,
    exceptions:class_schedule_recurrence_exceptions(id, occurrence_key, reason),
    overrides:class_schedule_recurrence_overrides(id, occurrence_key, patch)
  )
`;

export async function fetchSpaceSchedulesByChannelId(
  channelId: string,
  orgId: string,
): Promise<ClassScheduleVM[]> {
  const { data, error } = await supabase
    .from('class_schedules')
    .select(CLASS_SCHEDULE_SELECT)
    .eq('org_id', orgId)
    .eq('source_kind', 'class_session')
    .eq('source_channel_id', channelId)
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapClassScheduleRow(row as Record<string, unknown>));
}

export async function fetchOrgSessions(orgId: string): Promise<ClassScheduleVM[]> {
  const { data, error } = await supabase
    .from('class_schedules')
    .select(CLASS_SCHEDULE_SELECT)
    .eq('org_id', orgId)
    .eq('source_kind', 'class_session')
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapClassScheduleRow(row as Record<string, unknown>));
}

export async function cancelRecurringSessionOccurrence(
  input: CancelRecurringSessionOccurrenceInput,
): Promise<CancelRecurringSessionOccurrenceResult> {
  const { data, error } = await supabase
    .from('class_schedule_recurrence_exceptions')
    .insert({
      org_id: input.orgId,
      recurrence_id: input.recurrenceId,
      occurrence_key: input.occurrenceKey,
      reason: input.reason?.trim() || null,
    })
    .select('occurrence_key, reason')
    .single();

  if (error) throw error;

  return {
    occurrenceKey: (data?.occurrence_key as string) ?? input.occurrenceKey,
    reason: ((data?.reason as string | null) ?? input.reason?.trim()) || undefined,
  };
}
