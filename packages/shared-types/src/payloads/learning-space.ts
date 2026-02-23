import type { IANATimezone, ISODateTime, ThemeKey } from '@iconicedu/shared-types/shared/shared';
import type { RecurrenceFrequencyVM, WeekdayVM } from '@iconicedu/shared-types/vm/class-schedule';
import type { ChannelUiDefaultsVM } from '@iconicedu/shared-types/vm/channel';

export type LearningSpaceScheduleWeekdayTimePayload = {
  day: WeekdayVM;
  time: string;
};

export type LearningSpaceScheduleRulePayload = {
  frequency: RecurrenceFrequencyVM;
  interval?: number | null;
  byWeekday?: WeekdayVM[] | null;
  weekdayTimes?: LearningSpaceScheduleWeekdayTimePayload[] | null;
  count?: number | null;
  until?: ISODateTime | null;
  timezone?: IANATimezone | null;
};

export type LearningSpaceScheduleExceptionPayload = {
  date: string;
  reason?: string | null;
};

export type LearningSpaceScheduleOverridePayload = {
  originalDate: string;
  newDate: string;
  newTime?: string | null;
  reason?: string | null;
};

export type LearningSpaceSchedulePayload = {
  startDate: ISODateTime;
  timezone: IANATimezone;
  rule: LearningSpaceScheduleRulePayload;
  exceptions?: LearningSpaceScheduleExceptionPayload[] | null;
  overrides?: LearningSpaceScheduleOverridePayload[] | null;
};

export type LearningSpaceParticipantPayload = {
  profileId: string;
  kind: string;
  displayName: string;
  avatarUrl?: string | null;
  themeKey?: string | null;
};

export type LearningSpaceResourcePayload = {
  label: string;
  iconKey?: string | null;
  url?: string | null;
  status?: string | null;
  hidden?: boolean | null;
};

export type LearningSpaceCreatePayload = {
  basics: {
    title: string;
    kind: string;
    iconKey?: string | null;
    subject?: string | null;
    description?: string | null;
  };
  settings?: {
    themeKey?: ThemeKey | null;
    uiDefaults?: ChannelUiDefaultsVM | null;
  } | null;
  participants: LearningSpaceParticipantPayload[];
  resources?: LearningSpaceResourcePayload[] | null;
  schedules?: LearningSpaceSchedulePayload[] | null;
};
