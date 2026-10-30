import type {
  ClassScheduleParticipantVM,
  ClassSchedulePatchVM,
  ClassScheduleVM,
  EventSourceVM,
  RecurrenceVM,
  ThemeKey,
} from '@iconicedu/shared-types';

type ClassScheduleParticipantQueryRow = {
  profile_id: string;
  role: string | null;
  status: string | null;
  display_name: string | null;
  avatar_url: string | null;
  theme_key: string | null;
};

type ClassScheduleRecurrenceExceptionQueryRow = {
  occurrence_key: string;
  reason: string | null;
};

type ClassScheduleRecurrenceOverrideQueryRow = {
  occurrence_key: string;
  patch: Record<string, unknown> | null;
};

type ClassScheduleRecurrenceQueryRow = {
  id: string;
  frequency: string;
  interval: number | null;
  count: number | null;
  until: string | null;
  timezone: string | null;
  byday: string[] | null;
  exceptions: ClassScheduleRecurrenceExceptionQueryRow[] | null;
  overrides: ClassScheduleRecurrenceOverrideQueryRow[] | null;
};

/** Shape produced by SchedulesService's `CLASS_SCHEDULE_SELECT` nested query,
 * with `source_learning_space` attached by `attachLearningSpaceArchiveMetadata`. */
export type ClassScheduleQueryRow = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_link: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
  status: string;
  visibility: string;
  theme_key: string | null;
  source_kind: string;
  source_learning_space_id: string | null;
  source_channel_id: string | null;
  source_session_id: string | null;
  source_owner_user_id: string | null;
  source_created_by_user_id: string | null;
  source_related_learning_space_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  participants: ClassScheduleParticipantQueryRow[] | null;
  recurrence: ClassScheduleRecurrenceQueryRow[] | null;
  source_learning_space?: { status?: string | null; archived_at?: string | null } | null;
};

/** Matches apps/api/src/modules/profiles/profiles.service.ts's local copy of
 * the same helper — each app keeps its own since this is a pure value check. */
function resolveThemeKey(value?: string | null): ThemeKey | null {
  const allowed = new Set<ThemeKey>([
    'slate',
    'gray',
    'zinc',
    'neutral',
    'stone',
    'amber',
    'blue',
    'cyan',
    'emerald',
    'fuchsia',
    'green',
    'indigo',
    'lime',
    'orange',
    'pink',
    'purple',
    'red',
    'rose',
    'sky',
    'teal',
    'violet',
    'yellow',
  ]);
  return allowed.has(value as ThemeKey) ? (value as ThemeKey) : null;
}

function mapParticipant(
  row: ClassScheduleParticipantQueryRow,
  orgId: string,
): ClassScheduleParticipantVM {
  return {
    ids: { id: row.profile_id, orgId },
    role: row.role as ClassScheduleParticipantVM['role'],
    status: row.status as ClassScheduleParticipantVM['status'] | undefined,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? null,
    themeKey: resolveThemeKey(row.theme_key),
  };
}

function mapRecurrence(
  row: ClassScheduleRecurrenceQueryRow,
  orgId: string,
): RecurrenceVM {
  return {
    ids: { id: row.id, orgId },
    rule: {
      frequency: row.frequency as RecurrenceVM['rule']['frequency'],
      interval: row.interval ?? undefined,
      byWeekday: (row.byday as RecurrenceVM['rule']['byWeekday']) ?? undefined,
      count: row.count ?? undefined,
      until: row.until ?? undefined,
      timezone: row.timezone ?? undefined,
    },
    exceptions: (row.exceptions ?? []).map((exception) => ({
      occurrenceKey: exception.occurrence_key,
      reason: exception.reason ?? undefined,
    })),
    overrides: (row.overrides ?? []).map((override) => ({
      occurrenceKey: override.occurrence_key,
      patch: override.patch as ClassSchedulePatchVM,
    })),
  };
}

export function mapClassScheduleRow(row: ClassScheduleQueryRow): ClassScheduleVM {
  const orgId = row.org_id;

  const source = ((): EventSourceVM => {
    switch (row.source_kind) {
      case 'class_session':
        return {
          kind: 'class_session',
          learningSpaceId: row.source_learning_space_id ?? '',
          channelId: row.source_channel_id ?? undefined,
          sessionId: row.source_session_id ?? undefined,
          archivedAt: row.source_learning_space?.archived_at ?? null,
          learningSpaceStatus: row.source_learning_space?.status ?? null,
        };
      case 'availability_block':
        return {
          kind: 'availability_block',
          ownerUserId: row.source_owner_user_id ?? '',
        };
      case 'manual':
      default:
        return {
          kind: 'manual',
          createdByUserId: row.source_created_by_user_id ?? row.created_by ?? '',
          relatedTo: row.source_related_learning_space_id
            ? { kind: 'learning_space', id: row.source_related_learning_space_id }
            : undefined,
        };
    }
  })();

  const recurrenceRow = row.recurrence?.[0];

  return {
    ids: { id: row.id, orgId },
    title: row.title,
    description: row.description ?? null,
    location: row.location ?? null,
    meetingLink: row.meeting_link ?? null,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone ?? undefined,
    status: row.status as ClassScheduleVM['status'],
    visibility: row.visibility as ClassScheduleVM['visibility'],
    themeKey: resolveThemeKey(row.theme_key),
    participants: (row.participants ?? []).map((participant) =>
      mapParticipant(participant, orgId),
    ),
    source,
    recurrence: recurrenceRow ? mapRecurrence(recurrenceRow, orgId) : undefined,
    audit: {
      createdAt: row.created_at,
      createdBy: row.created_by ?? '',
      updatedAt: row.updated_at ?? undefined,
      updatedBy: row.updated_by ?? undefined,
    },
  };
}
