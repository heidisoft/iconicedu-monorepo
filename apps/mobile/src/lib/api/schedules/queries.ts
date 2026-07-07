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
import { apiGet, apiPost } from '@/lib/api/http-client';
import type {
  SelfServeSessionChangeResultVM,
  SelfServeRescheduleOptionsVM,
  SessionChangeRequestVM,
} from '@iconicedu/shared-types';

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

export type SelfServeCancelSessionInput = {
  orgId: string;
  scheduleId: string;
  occurrenceKey?: string | null;
  note?: string | null;
};

export type SelfServeRescheduleSessionInput = SelfServeCancelSessionInput & {
  startAt: string;
  endAt: string;
  timezone?: string | null;
};

export type SelfServeUndoCancelSessionInput = Omit<SelfServeCancelSessionInput, 'note'>;

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
            createdBy: (exception.created_by as string | null) ?? undefined,
            updatedBy: (exception.updated_by as string | null) ?? undefined,
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
    const sourceLearningSpace = row.source_learning_space as
      | Record<string, unknown>
      | null
      | undefined;
    source = {
      kind: 'class_session',
      learningSpaceId: row.source_learning_space_id as string,
      channelId: (row.source_channel_id as string | null) ?? undefined,
      sessionId: (row.source_session_id as string | null) ?? undefined,
      archivedAt: (sourceLearningSpace?.archived_at as string | null) ?? null,
      learningSpaceStatus: (sourceLearningSpace?.status as string | null) ?? null,
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

export async function fetchSpaceSchedulesByChannelId(
  channelId: string,
  orgId: string,
): Promise<ClassScheduleVM[]> {
  const data = await apiGet<Record<string, unknown>[]>('/schedules', {
    orgId,
    channelId,
  });
  return (data ?? []).map((row) => mapClassScheduleRow(row));
}

export async function fetchOrgSessions(orgId: string): Promise<ClassScheduleVM[]> {
  const data = await apiGet<Record<string, unknown>[]>('/schedules', { orgId });
  return (data ?? []).map((row) => mapClassScheduleRow(row));
}

export async function cancelRecurringSessionOccurrence(
  input: CancelRecurringSessionOccurrenceInput,
): Promise<CancelRecurringSessionOccurrenceResult> {
  const data = await apiPost<{ occurrence_key?: string; reason?: string | null }>(
    '/schedules/exceptions',
    {
      orgId: input.orgId,
      scheduleId: input.recurrenceId,
      date: input.occurrenceKey,
      reason: input.reason,
    },
  );

  return {
    occurrenceKey: (data?.occurrence_key as string) ?? input.occurrenceKey,
    reason: ((data?.reason as string | null) ?? input.reason?.trim()) || undefined,
  };
}

export async function selfServeCancelSession(
  input: SelfServeCancelSessionInput,
): Promise<SelfServeSessionChangeResultVM> {
  return apiPost<SelfServeSessionChangeResultVM>('/schedules/session/self-serve/cancel', {
    orgId: input.orgId,
    scheduleId: input.scheduleId,
    occurrenceKey: input.occurrenceKey ?? null,
    note: input.note ?? null,
  });
}

export async function selfServeRescheduleSession(
  input: SelfServeRescheduleSessionInput,
): Promise<SelfServeSessionChangeResultVM> {
  return apiPost<SelfServeSessionChangeResultVM>(
    '/schedules/session/self-serve/reschedule',
    {
      orgId: input.orgId,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      timezone: input.timezone ?? null,
      note: input.note ?? null,
    },
  );
}

export async function selfServeUndoCancelSession(
  input: SelfServeUndoCancelSessionInput,
): Promise<{ success: true; mode: 'single' | 'recurring' }> {
  return apiPost<{ success: true; mode: 'single' | 'recurring' }>(
    '/schedules/session/self-serve/undo-cancel',
    {
      orgId: input.orgId,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey ?? null,
    },
  );
}

export async function fetchSelfServeRescheduleOptions(input: {
  orgId: string;
  scheduleId: string;
  occurrenceKey?: string | null;
}): Promise<SelfServeRescheduleOptionsVM> {
  return apiGet<SelfServeRescheduleOptionsVM>(
    '/schedules/session/self-serve/reschedule-options',
    {
      orgId: input.orgId,
      scheduleId: input.scheduleId,
      occurrenceKey: input.occurrenceKey ?? null,
    },
  );
}

export async function fetchSessionChangeRequests(input: {
  orgId: string;
  channelId?: string | null;
  scheduleId?: string | null;
}): Promise<SessionChangeRequestVM[]> {
  return apiGet<SessionChangeRequestVM[]>('/schedules/session/change-requests', {
    orgId: input.orgId,
    channelId: input.channelId,
    scheduleId: input.scheduleId,
  });
}

export async function approveSessionChangeRequest(input: {
  requestId: string;
  note?: string | null;
}): Promise<SelfServeSessionChangeResultVM> {
  return apiPost<SelfServeSessionChangeResultVM>(
    `/schedules/session/change-requests/${input.requestId}/approve`,
    { note: input.note ?? null },
  );
}

export async function rejectSessionChangeRequest(input: {
  requestId: string;
  note?: string | null;
}): Promise<SelfServeSessionChangeResultVM> {
  return apiPost<SelfServeSessionChangeResultVM>(
    `/schedules/session/change-requests/${input.requestId}/reject`,
    { note: input.note ?? null },
  );
}
