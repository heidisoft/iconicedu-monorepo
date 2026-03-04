import type { DayKey } from '@iconicedu/shared-types/shared/availability';

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type WorkingHoursEntry = Readonly<{
  day: Weekday;
  enabled: boolean;
  from?: string | null;
  to?: string | null;
}>;

export type WorkingHoursSchedule = ReadonlyArray<WorkingHoursEntry>;

export const WEEKDAY_TO_DAY_KEY: Record<Weekday, DayKey> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export const DAY_KEY_TO_WEEKDAY: Record<DayKey, Weekday> = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: 'sunday',
};
