import type {
  ClassScheduleParticipantRow,
  ClassScheduleRecurrenceExceptionRow,
  ClassScheduleRecurrenceOverrideRow,
  ClassScheduleRecurrenceRow,
  ClassScheduleRow,
  ClassScheduleParticipantVM,
  ClassScheduleVM,
  EventSourceVM,
  RecurrenceExceptionVM,
  RecurrenceOverrideVM,
  RecurrenceRuleVM,
  RecurrenceVM,
  WeekdayVM,
} from '@iconicedu/shared-types';
import { resolveThemeKey } from '@iconicedu/web/lib/profile/derive';

const VALID_WEEKDAYS: Set<WeekdayVM> = new Set([
  'MO',
  'TU',
  'WE',
  'TH',
  'FR',
  'SA',
  'SU',
]);

function isWeekday(value: string): value is WeekdayVM {
  return VALID_WEEKDAYS.has(value as WeekdayVM);
}

export function mapClassScheduleParticipantRow(
  row: ClassScheduleParticipantRow,
): ClassScheduleParticipantVM {
  return {
    ids: { id: row.profile_id, orgId: row.org_id },
    role: row.role as ClassScheduleParticipantVM['role'],
    status: row.status as ClassScheduleParticipantVM['status'] | undefined,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? null,
    themeKey: resolveThemeKey(row.theme_key ?? null),
  };
}

export function mapClassScheduleRecurrenceRow(
  row: ClassScheduleRecurrenceRow,
  input?: {
    exceptions?: ClassScheduleRecurrenceExceptionRow[];
    overrides?: ClassScheduleRecurrenceOverrideRow[];
  },
): RecurrenceVM {
  const exceptions: RecurrenceExceptionVM[] =
    input?.exceptions?.map((exception) => ({
      occurrenceKey: exception.occurrence_key,
      reason: exception.reason ?? undefined,
    })) ?? [];

  const overrides: RecurrenceOverrideVM[] =
    input?.overrides?.map((override) => ({
      occurrenceKey: override.occurrence_key,
      patch: override.patch as RecurrenceOverrideVM['patch'],
    })) ?? [];

  return {
    ids: { id: row.id, orgId: row.org_id },
    rule: {
      frequency: row.frequency as RecurrenceRuleVM['frequency'],
      interval: row.interval ?? undefined,
      byWeekday: row.byday?.filter(isWeekday) ?? undefined,
      count: row.count ?? undefined,
      until: row.until ?? undefined,
      timezone: row.timezone ?? undefined,
    },
    exceptions: exceptions.length ? exceptions : undefined,
    overrides: overrides.length ? overrides : undefined,
  };
}

export function mapClassScheduleRow(
  row: ClassScheduleRow,
  input: {
    participants: ClassScheduleParticipantVM[];
    recurrence?: RecurrenceVM | null;
  },
): ClassScheduleVM {
  const source = (() => {
    switch (row.source_kind) {
      case 'class_session':
        return {
          kind: 'class_session',
          learningSpaceId: row.source_learning_space_id ?? '',
          channelId: row.source_channel_id ?? undefined,
          sessionId: row.source_session_id ?? undefined,
          archivedAt: row.source_learning_space?.archived_at ?? null,
          learningSpaceStatus: row.source_learning_space?.status ?? null,
        } satisfies EventSourceVM;
      case 'availability_block':
        return {
          kind: 'availability_block',
          ownerUserId: row.source_owner_user_id ?? '',
        } satisfies EventSourceVM;
      case 'manual':
      default:
        return {
          kind: 'manual',
          createdByUserId: row.source_created_by_user_id ?? row.created_by ?? '',
          relatedTo: row.source_related_learning_space_id
            ? { kind: 'learning_space', id: row.source_related_learning_space_id }
            : undefined,
        } satisfies EventSourceVM;
    }
  })();

  return {
    ids: { id: row.id, orgId: row.org_id },
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    meetingLink: row.meeting_link ?? null,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone ?? undefined,
    status: row.status as ClassScheduleVM['status'],
    visibility: row.visibility as ClassScheduleVM['visibility'],
    themeKey: resolveThemeKey(row.theme_key ?? null),
    participants: input.participants,
    source,
    recurrence: input.recurrence ?? undefined,
    audit: {
      createdAt: row.created_at,
      createdBy: row.created_by ?? '',
      updatedAt: row.updated_at ?? undefined,
      updatedBy: row.updated_by ?? undefined,
      deletedAt: row.deleted_at ?? undefined,
      deletedBy: row.deleted_by ?? undefined,
    },
  };
}
