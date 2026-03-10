export type RecurrenceFrequencyVM = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type WeekdayVM = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export type ISODateTime = string;

export type ISODate = string;

export type IANATimezone = string;

export type TimeString = string;

export interface WeekdayTime {
  day: WeekdayVM;
  time: TimeString;
}

export interface RecurrenceException {
  id: string;
  date: ISODate;
  reason?: string;
}

export interface RecurrenceOverride {
  id: string;
  originalDate: ISODate;
  newDate: ISODate;
  newTime?: TimeString;
  reason?: string;
}

export interface RecurrenceRuleVM {
  frequency: RecurrenceFrequencyVM;
  interval?: number;
  byWeekday?: WeekdayVM[];
  weekdayTimes?: WeekdayTime[];
  byMonthDay?: number[];
  bySetPos?: number[];
  byMonth?: number[];
  monthlyMode?: 'day_of_month' | 'weekday_of_month';
  yearlyMode?: 'date_of_month' | 'weekday_of_month';
  count?: number;
  until?: ISODateTime;
  timezone?: IANATimezone;
}

export interface RecurrenceFormData {
  id?: string;
  startDate: Date | undefined;
  startTime: TimeString;
  endTime: TimeString;
  timezone: IANATimezone;
  rule?: RecurrenceRuleVM;
  exceptions: RecurrenceException[];
  overrides: RecurrenceOverride[];
}

export const WEEKDAYS: { value: WeekdayVM; label: string; short: string }[] = [
  { value: 'MO', label: 'Monday', short: 'M' },
  { value: 'TU', label: 'Tuesday', short: 'T' },
  { value: 'WE', label: 'Wednesday', short: 'W' },
  { value: 'TH', label: 'Thursday', short: 'T' },
  { value: 'FR', label: 'Friday', short: 'F' },
  { value: 'SA', label: 'Saturday', short: 'S' },
  { value: 'SU', label: 'Sunday', short: 'S' },
];

export const FREQUENCIES: { value: RecurrenceFrequencyVM; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export const COMMON_TIMEZONES: { value: IANATimezone; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];
