import type { IdsBaseVM, ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { ChannelVM } from '@iconicedu/shared-types/vm/channel';
import type { ClassScheduleVM } from '@iconicedu/shared-types/vm/class-schedule';
import type { UserProfileVM } from '@iconicedu/shared-types/vm/profile';

export type LearningSpaceKindVM = 'one_on_one' | 'small_group' | 'large_class';
export type LearningSpaceStatusVM = 'active' | 'archived' | 'completed' | 'paused';

export interface LearningSpaceBasicsVM {
  kind: LearningSpaceKindVM;
  status: LearningSpaceStatusVM;

  title: string;
  iconKey: string | null;

  subject?: string | null;
  description?: string | null;
}

export interface LearningSpaceChannelsVM {
  primaryChannel: ChannelVM;
  relatedChannels?: ChannelVM[];
}

export interface LearningSpaceScheduleVM {
  scheduleSeries?: ClassScheduleVM | null;
}

export interface LearningSpaceLifecycleVM {
  createdAt: ISODateTime;
  createdBy: UUID;
  archivedAt?: ISODateTime | null;
}

export interface LearningSpaceVM {
  ids: IdsBaseVM;
  basics: LearningSpaceBasicsVM;

  channels: LearningSpaceChannelsVM;

  schedule?: LearningSpaceScheduleVM;

  lifecycle: LearningSpaceLifecycleVM;

  participants: UserProfileVM[];
}

/** Snapshot of a learning space's current persisted state needed to diff an
 * incoming admin-editor save against — schedules/recurrences/exceptions/
 * overrides are scoped to just this learning space's own schedules (not
 * every schedule in the org). */
export interface LearningSpaceEditContextScheduleVM {
  id: UUID;
  title: string;
  startAt: ISODateTime;
  endAt: ISODateTime;
  timezone: string | null;
}

export interface LearningSpaceEditContextRecurrenceVM {
  id: UUID;
  scheduleId: UUID;
  frequency: string;
  interval?: number | null;
  count?: number | null;
  until?: ISODateTime | null;
  timezone: string | null;
  bySecond?: number[] | null;
  byMinute?: number[] | null;
  byHour?: number[] | null;
  byDay?: string[] | null;
  byMonthDay?: number[] | null;
  byYearDay?: number[] | null;
  byWeekNo?: number[] | null;
  byMonth?: number[] | null;
  bySetPos?: number[] | null;
  wkst?: string | null;
}

export interface LearningSpaceEditContextExceptionVM {
  recurrenceId: UUID;
  occurrenceKey: ISODateTime;
  reason: string | null;
}

export interface LearningSpaceEditContextOverrideVM {
  recurrenceId: UUID;
  occurrenceKey: ISODateTime;
  patch: Record<string, unknown> | null;
}

export interface LearningSpaceEditContextChannelVM {
  topic: string | null;
  description: string | null;
  iconKey: string | null;
  themeKey: string | null;
  uiDefaults: unknown;
  liveSessionConfig: unknown;
}

export interface LearningSpaceEditContextVM {
  participantProfileIds: UUID[];
  schedules: LearningSpaceEditContextScheduleVM[];
  recurrences: LearningSpaceEditContextRecurrenceVM[];
  exceptions: LearningSpaceEditContextExceptionVM[];
  overrides: LearningSpaceEditContextOverrideVM[];
  channel: LearningSpaceEditContextChannelVM | null;
}
