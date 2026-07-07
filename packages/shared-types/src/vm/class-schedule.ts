import type {
  IANATimezone,
  IdsBaseVM,
  ISODateTime,
  ThemeKey,
  UUID,
} from '@iconicedu/shared-types/shared/shared';

export type WeekdayVM = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export type ClassScheduleViewVM = 'week' | 'day' | 'month' | 'agenda';

export type ClassScheduleVisibilityVM =
  | 'private'
  | 'internal'
  | 'class-members'
  | 'public';

export type ParticipantRoleVM = 'educator' | 'child' | 'guardian' | 'staff' | 'observer';
export type ParticipationStatusVM = 'invited' | 'accepted' | 'declined' | 'tentative';

export interface ClassScheduleParticipantVM {
  ids: IdsBaseVM;
  role: ParticipantRoleVM;
  status?: ParticipationStatusVM;

  displayName?: string;
  avatarUrl?: string | null;
  themeKey?: ThemeKey | null;
}

export type EventSourceVM =
  | {
      kind: 'class_session';
      learningSpaceId: UUID;
      channelId?: UUID;
      sessionId?: UUID;
      archivedAt?: ISODateTime | null;
      learningSpaceStatus?: string | null;
    }
  | { kind: 'availability_block'; ownerUserId: UUID }
  | {
      kind: 'manual';
      createdByUserId: UUID;
      relatedTo?: { kind: 'learning_space'; id: UUID };
    };

export type EventStatusVM = 'scheduled' | 'cancelled' | 'completed' | 'rescheduled';

export type CancelReasonVM =
  | 'guardian'
  | 'educator'
  | 'staff'
  | 'no_show'
  | 'holiday'
  | 'other';

export interface EventAuditInfoVM {
  createdAt: ISODateTime;
  createdBy: UUID;

  updatedAt?: ISODateTime;
  updatedBy?: UUID;

  cancelledAt?: ISODateTime;
  cancelledBy?: UUID;
  cancelReason?: CancelReasonVM;
  cancelNote?: string | null;

  deletedAt?: ISODateTime;
  deletedBy?: UUID;
}

export type RecurrenceFrequencyVM = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRuleVM {
  frequency: RecurrenceFrequencyVM;
  interval?: number;
  byWeekday?: WeekdayVM[];
  byMonthDay?: number[];
  bySetPos?: number[];
  byMonth?: number[];
  monthlyMode?: 'day_of_month' | 'weekday_of_month';
  yearlyMode?: 'date_of_month' | 'weekday_of_month';
  count?: number;
  until?: ISODateTime;
  timezone?: IANATimezone;
}

export interface RecurrenceExceptionVM {
  occurrenceKey: ISODateTime;
  reason?: string;
  createdBy?: UUID;
  updatedBy?: UUID;
}

export interface RecurrenceOverrideVM {
  occurrenceKey: ISODateTime;
  patch: ClassSchedulePatchVM;
}

export interface RecurrenceVM {
  ids: IdsBaseVM;
  rule: RecurrenceRuleVM;
  exceptions?: RecurrenceExceptionVM[];
  overrides?: RecurrenceOverrideVM[];
}

export interface ClassScheduleVM {
  ids: IdsBaseVM;

  title: string;
  description?: string | null;
  location?: string | null;
  meetingLink?: string | null;

  startAt: ISODateTime;
  endAt: ISODateTime;
  timezone?: IANATimezone;

  status: EventStatusVM;
  visibility: ClassScheduleVisibilityVM;
  themeKey?: ThemeKey | null;

  participants: ClassScheduleParticipantVM[];
  source: EventSourceVM;

  recurrence?: RecurrenceVM;

  audit: EventAuditInfoVM;
}

export type ClassSchedulePatchVM = Partial<
  Pick<
    ClassScheduleVM,
    | 'title'
    | 'description'
    | 'location'
    | 'meetingLink'
    | 'startAt'
    | 'endAt'
    | 'status'
    | 'participants'
    | 'visibility'
    | 'source'
    | 'timezone'
  >
>;

export interface EventInstanceKeyVM {
  ids: IdsBaseVM;
  occurrenceKey: ISODateTime;
}

export interface ClassScheduleInstanceVM {
  ids: IdsBaseVM;

  key: EventInstanceKeyVM;

  startAt: ISODateTime;
  endAt: ISODateTime;
  timezone?: IANATimezone;

  status: EventStatusVM;
  isCancelled?: boolean;

  title: string;
  description?: string | null;
  location?: string | null;
  meetingLink?: string | null;

  visibility: ClassScheduleVisibilityVM;

  participants: ClassScheduleParticipantVM[];
  source: EventSourceVM;
}

export type ArchiveAwareClassScheduleVM = ClassScheduleVM & {
  uiState?: {
    kind?: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    cancelledByProfileId?: UUID | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
};

export function getClassScheduleArchiveCutoff(
  schedule: Pick<ClassScheduleVM, 'source'>,
): ISODateTime | null {
  if (schedule.source.kind !== 'class_session') return null;
  return schedule.source.archivedAt ?? null;
}

export function isClassScheduleArchived(
  schedule: Pick<ClassScheduleVM, 'source'>,
): boolean {
  if (schedule.source.kind !== 'class_session') return false;
  return Boolean(
    schedule.source.archivedAt || schedule.source.learningSpaceStatus === 'archived',
  );
}

export function isClassScheduleAfterArchiveCutoff(
  schedule: Pick<ClassScheduleVM, 'source' | 'startAt'>,
): boolean {
  const archivedAt = getClassScheduleArchiveCutoff(schedule);
  if (!archivedAt) return false;

  const startMs = new Date(schedule.startAt).getTime();
  const archivedMs = new Date(archivedAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(archivedMs)) return false;

  return startMs > archivedMs;
}

export function applyArchiveCutoffToDisplaySchedules<
  T extends ArchiveAwareClassScheduleVM,
>(schedules: T[]): T[] {
  return schedules
    .filter((schedule) => !isClassScheduleAfterArchiveCutoff(schedule))
    .map((schedule) => {
      if (!isClassScheduleArchived(schedule)) return schedule;

      return {
        ...schedule,
        meetingLink: null,
        uiState: {
          ...schedule.uiState,
          disabled: true,
          reason: schedule.uiState?.reason ?? 'Classroom archived',
        },
      };
    });
}
