import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfWeek,
} from 'date-fns';

import type {
  ISODate,
  RecurrenceException,
  RecurrenceFrequencyVM,
  RecurrenceOverride,
  WeekdayVM,
} from '@iconicedu/ui-web/lib/recurrence-types';

const WEEKDAY_INDEX: Record<WeekdayVM, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 0,
};

interface UpcomingRecurrenceDateOptions {
  startDate?: Date;
  frequency: RecurrenceFrequencyVM;
  interval?: number;
  byWeekday?: WeekdayVM[];
  count?: number;
  until?: string;
  fromDate?: Date;
  maxResults?: number;
  includeDates?: ISODate[];
}

function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function toIsoDateBoundary(value: string) {
  return value.slice(0, 10);
}

function sortIsoDatesAsc(a: ISODate, b: ISODate) {
  return a.localeCompare(b);
}

function getWeeklyWeekOffset(date: Date, startDate: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const initialWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });
  return Math.floor(differenceInCalendarDays(weekStart, initialWeekStart) / 7);
}

function buildDailyMonthlyOrYearlyOccurrences({
  startDate,
  frequency,
  interval,
  count,
  untilDate,
  fromDate,
  maxResults,
}: Required<
  Pick<
    UpcomingRecurrenceDateOptions,
    'frequency' | 'interval' | 'fromDate' | 'maxResults'
  >
> & {
  startDate: Date;
  count?: number;
  untilDate?: ISODate;
}) {
  const dates: ISODate[] = [];
  const seen = new Set<ISODate>();
  let currentDate = startDate;
  let occurrenceCount = 0;
  let safetyCounter = 0;

  while (dates.length < maxResults && safetyCounter < 1000) {
    safetyCounter += 1;
    if (untilDate && toIsoDate(currentDate) > untilDate) break;

    occurrenceCount += 1;
    if (count && occurrenceCount > count) break;

    if (currentDate >= fromDate) {
      const isoDate = toIsoDate(currentDate);
      if (!seen.has(isoDate)) {
        seen.add(isoDate);
        dates.push(isoDate);
      }
    }

    if (frequency === 'daily') {
      currentDate = addDays(currentDate, interval);
      continue;
    }

    if (frequency === 'monthly') {
      currentDate = addMonths(currentDate, interval);
      continue;
    }

    currentDate = addYears(currentDate, interval);
  }

  return dates;
}

function buildWeeklyOccurrences({
  startDate,
  interval,
  byWeekday,
  count,
  untilDate,
  fromDate,
  maxResults,
}: Required<
  Pick<UpcomingRecurrenceDateOptions, 'interval' | 'fromDate' | 'maxResults'>
> & {
  startDate: Date;
  byWeekday?: WeekdayVM[];
  count?: number;
  untilDate?: ISODate;
}) {
  const dates: ISODate[] = [];
  const seen = new Set<ISODate>();
  const selectedWeekdays =
    byWeekday && byWeekday.length > 0
      ? new Set(byWeekday.map((weekday) => WEEKDAY_INDEX[weekday]))
      : new Set([startDate.getDay()]);

  let currentDate = startDate;
  let occurrenceCount = 0;
  let safetyCounter = 0;

  while (dates.length < maxResults && safetyCounter < 3650) {
    safetyCounter += 1;
    if (untilDate && toIsoDate(currentDate) > untilDate) break;

    const weekOffset = getWeeklyWeekOffset(currentDate, startDate);
    const matchesWeek = weekOffset >= 0 && weekOffset % interval === 0;
    const matchesWeekday = selectedWeekdays.has(currentDate.getDay());

    if (matchesWeek && matchesWeekday) {
      occurrenceCount += 1;
      if (count && occurrenceCount > count) break;

      if (currentDate >= fromDate) {
        const isoDate = toIsoDate(currentDate);
        if (!seen.has(isoDate)) {
          seen.add(isoDate);
          dates.push(isoDate);
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return dates;
}

export function getUpcomingRecurrenceDates({
  startDate,
  frequency,
  interval = 1,
  byWeekday,
  count,
  until,
  fromDate = new Date(),
  maxResults = 24,
  includeDates = [],
}: UpcomingRecurrenceDateOptions): ISODate[] {
  if (!startDate) return includeDates.slice().sort(sortIsoDatesAsc);

  const normalizedStartDate = startOfDay(startDate);
  const normalizedFromDate = startOfDay(fromDate);
  const normalizedUntilDate = until ? toIsoDateBoundary(until) : undefined;

  const computedDates =
    frequency === 'weekly'
      ? buildWeeklyOccurrences({
          startDate: normalizedStartDate,
          interval,
          byWeekday,
          count,
          untilDate: normalizedUntilDate,
          fromDate: normalizedFromDate,
          maxResults,
        })
      : buildDailyMonthlyOrYearlyOccurrences({
          startDate: normalizedStartDate,
          frequency,
          interval,
          count,
          untilDate: normalizedUntilDate,
          fromDate: normalizedFromDate,
          maxResults,
        });

  return Array.from(new Set([...computedDates, ...includeDates])).sort(sortIsoDatesAsc);
}

interface UpsertPendingExceptionOptions {
  exceptions: RecurrenceException[];
  editingExceptionId?: string | null;
  pendingDate?: Date;
  pendingReason?: string;
  allowedDates?: Iterable<ISODate>;
}

export function upsertPendingException({
  exceptions,
  editingExceptionId,
  pendingDate,
  pendingReason,
  allowedDates = [],
}: UpsertPendingExceptionOptions) {
  if (!pendingDate) return exceptions;

  const nextDate = toIsoDate(pendingDate);
  const allowedDateSet = new Set(allowedDates);
  if (allowedDateSet.size > 0 && !allowedDateSet.has(nextDate)) {
    return exceptions;
  }

  const nextReason = pendingReason?.trim() || undefined;

  if (editingExceptionId) {
    return exceptions.map((exception) =>
      exception.id === editingExceptionId
        ? {
            ...exception,
            date: nextDate,
            reason: nextReason,
          }
        : exception,
    );
  }

  const duplicate = exceptions.some((exception) => exception.date === nextDate);
  if (duplicate) {
    return exceptions;
  }

  return [
    ...exceptions,
    {
      id: Math.random().toString(36).substring(2, 9),
      date: nextDate,
      reason: nextReason,
    },
  ];
}

interface UpsertPendingOverrideOptions {
  overrides: RecurrenceOverride[];
  editingOverrideId?: string | null;
  pendingOriginalDate?: Date;
  pendingNewDate?: Date;
  pendingNewTime?: string;
  pendingReason?: string;
  allowedOriginalDates?: Iterable<ISODate>;
}

export function upsertPendingOverride({
  overrides,
  editingOverrideId,
  pendingOriginalDate,
  pendingNewDate,
  pendingNewTime,
  pendingReason,
  allowedOriginalDates = [],
}: UpsertPendingOverrideOptions) {
  if (!pendingOriginalDate || !pendingNewDate) return overrides;

  const nextOriginalDate = toIsoDate(pendingOriginalDate);
  const nextNewDate = toIsoDate(pendingNewDate);
  const allowedOriginalDateSet = new Set(allowedOriginalDates);
  if (allowedOriginalDateSet.size > 0 && !allowedOriginalDateSet.has(nextOriginalDate)) {
    return overrides;
  }

  const nextReason = pendingReason?.trim() || undefined;
  const nextNewTime = pendingNewTime?.trim() || undefined;

  if (editingOverrideId) {
    return overrides.map((override) =>
      override.id === editingOverrideId
        ? {
            ...override,
            originalDate: nextOriginalDate,
            newDate: nextNewDate,
            newTime: nextNewTime,
            reason: nextReason,
          }
        : override,
    );
  }

  const duplicate = overrides.some(
    (override) => override.originalDate === nextOriginalDate,
  );
  if (duplicate) {
    return overrides;
  }

  return [
    ...overrides,
    {
      id: Math.random().toString(36).substring(2, 9),
      originalDate: nextOriginalDate,
      newDate: nextNewDate,
      newTime: nextNewTime,
      reason: nextReason,
    },
  ];
}
