import type {
  ArchiveAwareClassScheduleVM,
  ClassScheduleVM,
  ClassScheduleViewVM,
  RecurrenceVM,
  WeekdayVM,
} from '@iconicedu/shared-types';
import { applyArchiveCutoffToDisplaySchedules } from '@iconicedu/shared-types';
import { getLocalDate, getLocalTime, toUtcFromLocal } from '@iconicedu/utils';
import {
  formatScheduleDisplayTimeWithZone,
  formatScheduleDisplayValue,
  getScheduleDisplayDateParts,
  getScheduleDisplayDayKey,
  resolveScheduleDisplayTimeZone,
  toScheduleDisplayDate,
  getScheduleDisplayMinutes,
  type ScheduleDisplayTimeZoneInput,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';
import { WEEKDAYS } from '@iconicedu/ui-web/lib/recurrence-types';

export type DisplayClassScheduleVM = ArchiveAwareClassScheduleVM;

function getScheduleTimezone(event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>) {
  return event.timezone ?? event.recurrence?.rule.timezone ?? 'UTC';
}

function getScheduleDisplayTimezoneInput(
  event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>,
  viewerTimezone?: string | null,
): ScheduleDisplayTimeZoneInput {
  return {
    viewerTimezone,
    scheduleTimezone: event.timezone ?? event.recurrence?.rule.timezone ?? null,
  };
}

export function getWeekDays(date: Date): Date[] {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startOfWeek);
    currentDate.setDate(startOfWeek.getDate() + i);
    days.push(currentDate);
  }
  return days;
}

export function formatDate(date: Date, timezone?: string | null): string {
  return (
    formatScheduleDisplayValue(date, timezone, {
      month: 'short',
      day: 'numeric',
    }) ?? ''
  );
}

/**
 * Formats the weekday of a *display date* — a runtime-local `Date` whose fields
 * already carry the viewer's wall-clock values, as produced by `getEventDate`
 * and `getDisplayNow`.
 *
 * Such a value must be read from its local fields. Passing it through an `Intl`
 * formatter with an explicit `timeZone` converts an already-converted value a
 * second time and can shift the result by a day, which is how the calendar came
 * to label a Monday column "Sun". The week range label in the header has always
 * used local fields for exactly this reason.
 */
export function formatDayName(date: Date): string {
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
}

export function formatMonthYear(date: Date, timezone?: string | null): string {
  return (
    formatScheduleDisplayValue(date, timezone, {
      month: 'long',
      year: 'numeric',
    }) ?? ''
  );
}

export function formatEventTime(isoTime: string, timezone?: string | null): string {
  return (
    formatScheduleDisplayTimeWithZone(isoTime, timezone, {
      hour: 'numeric',
      minute: '2-digit',
    }) ?? ''
  );
}

export function formatEventTimeForSchedule(
  event: Pick<ClassScheduleVM, 'startAt' | 'endAt' | 'timezone' | 'recurrence'>,
  key: 'startAt' | 'endAt',
  timezone?: string | null,
): string {
  return (
    formatScheduleDisplayTimeWithZone(
      event[key],
      getScheduleDisplayTimezoneInput(event, timezone),
      {
        hour: 'numeric',
        minute: '2-digit',
      },
    ) ?? ''
  );
}

/**
 * Returns a compact time range string like "9:00 – 9:45am" or "9:00am – 1:00pm".
 * The period (am/pm) is omitted from the start when both times share the same period.
 *
 * Uses raw date parts rather than the formatted string to avoid the timezone suffix
 * that formatEventTimeForSchedule appends (e.g. "9:00 AM EST"), which would break
 * the AM/PM regex match.
 */
export function formatEventTimeRange(
  event: Pick<ClassScheduleVM, 'startAt' | 'endAt' | 'timezone' | 'recurrence'>,
  timezone?: string | null,
): string {
  const tzInput = getScheduleDisplayTimezoneInput(event, timezone);
  const startParts = getScheduleDisplayDateParts(event.startAt, tzInput);
  const endParts = getScheduleDisplayDateParts(event.endAt, tzInput);

  if (!startParts || !endParts) {
    return `${formatEventTimeForSchedule(event, 'startAt', timezone)} – ${formatEventTimeForSchedule(event, 'endAt', timezone)}`;
  }

  const fmt = (hour: number, minute: number) =>
    `${hour % 12 || 12}:${String(minute).padStart(2, '0')}`;

  const startPeriod = startParts.hour < 12 ? 'am' : 'pm';
  const endPeriod = endParts.hour < 12 ? 'am' : 'pm';
  const startTime = fmt(startParts.hour, startParts.minute);
  const endTime = fmt(endParts.hour, endParts.minute);

  if (startPeriod === endPeriod) {
    return `${startTime} – ${endTime}${endPeriod}`;
  }
  return `${startTime}${startPeriod} – ${endTime}${endPeriod}`;
}

/**
 * Returns a human-readable recurrence label like "Weekly on Saturday", "Daily",
 * "Every 2 weeks on Monday, Wednesday", etc. Returns null for non-recurring events.
 */
export function formatEventRecurrenceLabel(
  recurrence?: RecurrenceVM | null,
): string | null {
  if (!recurrence) return null;
  const { rule } = recurrence;
  const interval = rule.interval ?? 1;

  if (rule.frequency === 'daily') {
    return interval > 1 ? `Every ${interval} days` : 'Daily';
  }

  if (rule.frequency === 'weekly') {
    const dayLabels = (rule.byWeekday ?? [])
      .map((day) => WEEKDAYS.find((w) => w.value === day)?.label)
      .filter((l): l is string => Boolean(l))
      .join(', ');
    const prefix = interval > 1 ? `Every ${interval} weeks` : 'Weekly';
    return dayLabels ? `${prefix} on ${dayLabels}` : prefix;
  }

  if (rule.frequency === 'monthly') {
    return interval > 1 ? `Every ${interval} months` : 'Monthly';
  }

  return interval > 1 ? `Every ${interval} years` : 'Yearly';
}

export function getEventDate(event: ClassScheduleVM, timezone?: string | null): Date {
  return (
    toScheduleDisplayDate(
      event.startAt,
      getScheduleDisplayTimezoneInput(event, timezone),
    ) ?? new Date(event.startAt)
  );
}

/**
 * "Now" as a display date: a runtime-local `Date` whose fields carry the
 * viewer's wall-clock values, matching what `getEventDate` returns.
 *
 * Views must use this rather than `new Date()`. A raw `Date` reports the
 * browser's clock, so "today" highlighting and the current-time indicator
 * would follow the machine timezone while the events around them follow the
 * viewer's — the two can land on different calendar days.
 */
export function getDisplayNow(timezone?: string | null): Date {
  return toScheduleDisplayDate(new Date(), timezone) ?? new Date();
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

export function timeToMinutes(
  input: string | Pick<ClassScheduleVM, 'startAt' | 'timezone' | 'recurrence'>,
  timezone?: string | null,
): number {
  if (typeof input === 'string') {
    return getScheduleDisplayMinutes(input, timezone);
  }

  return getScheduleDisplayMinutes(
    input.startAt,
    getScheduleDisplayTimezoneInput(input, timezone),
  );
}

export function eventTimeToMinutes(
  event: Pick<ClassScheduleVM, 'startAt' | 'endAt' | 'timezone' | 'recurrence'>,
  key: 'startAt' | 'endAt',
  timezone?: string | null,
): number {
  return getScheduleDisplayMinutes(
    event[key],
    getScheduleDisplayTimezoneInput(event, timezone),
  );
}

export function getDisplayEventState(event: ClassScheduleVM | DisplayClassScheduleVM) {
  const uiState = (event as DisplayClassScheduleVM).uiState;
  return {
    kind: uiState?.kind ?? 'default',
    disabled: uiState?.disabled ?? false,
    reason: uiState?.reason ?? null,
    originalStartAt: uiState?.originalStartAt ?? null,
    originalEndAt: uiState?.originalEndAt ?? null,
  };
}

export function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const period = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const displayMinute = minute.toString().padStart(2, '0');
      slots.push(`${displayHour}:${displayMinute} ${period}`);
    }
  }
  return slots;
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  const firstDayOfWeek = firstDay.getDay();
  const daysFromPrevMonth = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  for (let i = daysFromPrevMonth; i > 0; i--) {
    const date = new Date(year, month, -i + 1);
    days.push(date);
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

export function getEventLayout(events: ClassScheduleVM[], timezone?: string | null) {
  const sorted = [...events].sort((a, b) => {
    const aStart = eventTimeToMinutes(a, 'startAt', timezone);
    const bStart = eventTimeToMinutes(b, 'startAt', timezone);
    if (aStart !== bStart) return aStart - bStart;
    return (
      eventTimeToMinutes(a, 'endAt', timezone) - eventTimeToMinutes(b, 'endAt', timezone)
    );
  });

  const clusters: ClassScheduleVM[][] = [];
  let currentCluster: ClassScheduleVM[] = [];
  let currentEnd = -1;

  sorted.forEach((event) => {
    const start = eventTimeToMinutes(event, 'startAt', timezone);
    const end = eventTimeToMinutes(event, 'endAt', timezone);

    if (currentCluster.length === 0 || start < currentEnd) {
      currentCluster.push(event);
      currentEnd = Math.max(currentEnd, end);
      return;
    }

    clusters.push(currentCluster);
    currentCluster = [event];
    currentEnd = end;
  });

  if (currentCluster.length) {
    clusters.push(currentCluster);
  }

  const layout = new Map<
    string,
    { column: number; columns: number; clusterId: number }
  >();

  clusters.forEach((cluster, clusterId) => {
    const columnEndTimes: number[] = [];
    const assignments: Array<{ id: string; column: number }> = [];

    cluster.forEach((event) => {
      const start = eventTimeToMinutes(event, 'startAt', timezone);
      const end = eventTimeToMinutes(event, 'endAt', timezone);
      let columnIndex = columnEndTimes.findIndex((time) => time <= start);

      if (columnIndex === -1) {
        columnIndex = columnEndTimes.length;
        columnEndTimes.push(end);
      } else {
        columnEndTimes[columnIndex] = end;
      }

      assignments.push({ id: event.ids.id, column: columnIndex });
    });

    const columns = columnEndTimes.length;
    assignments.forEach((assignment) => {
      layout.set(assignment.id, { column: assignment.column, columns, clusterId });
    });
  });

  return layout;
}

export interface HiddenEventOverflowGroup {
  clusterId: number;
  startMinutes: number;
  hiddenEvents: ClassScheduleVM[];
  columns: number;
}

export function getHiddenEventOverflowGroups(
  events: ClassScheduleVM[],
  layout: Map<string, { column: number; columns: number; clusterId: number }>,
  maxVisibleColumns: number,
  timezone?: string | null,
): HiddenEventOverflowGroup[] {
  const groups = new Map<string, HiddenEventOverflowGroup>();

  events.forEach((event) => {
    const eventLayout = layout.get(event.ids.id);
    if (!eventLayout || eventLayout.column < maxVisibleColumns) {
      return;
    }

    const startMinutes = eventTimeToMinutes(event, 'startAt', timezone);
    const key = `${eventLayout.clusterId}:${startMinutes}`;
    const group = groups.get(key);

    if (group) {
      group.hiddenEvents.push(event);
      return;
    }

    groups.set(key, {
      clusterId: eventLayout.clusterId,
      startMinutes,
      hiddenEvents: [event],
      columns: eventLayout.columns,
    });
  });

  return [...groups.values()].sort((left, right) => {
    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes;
    }

    return left.clusterId - right.clusterId;
  });
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateKey(value: string) {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number.parseInt(yearText ?? '1970', 10);
  const month = Number.parseInt(monthText ?? '1', 10);
  const day = Number.parseInt(dayText ?? '1', 10);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function getDateDiffInDays(left: string, right: string) {
  return Math.round(
    (parseDateKey(left).getTime() - parseDateKey(right).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

function getWeekdayTokenFromDateKey(value: string): WeekdayVM {
  const weekday = parseDateKey(value).getUTCDay();
  return weekdayTokens[weekday] ?? 'MO';
}

function getScheduleLocalDayKey(
  isoDateTime: string,
  event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>,
) {
  return (
    getLocalDate(isoDateTime, getScheduleTimezone(event)) ?? isoDateTime.slice(0, 10)
  );
}

const weekdayTokens: WeekdayVM[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const getDisplaySchedulePriority = (schedule: DisplayClassScheduleVM) => {
  if (schedule.uiState?.kind === 'exception') return 3;
  if (schedule.uiState?.kind === 'override') return 2;
  return 1;
};

const getDisplayScheduleBaseId = (schedule: DisplayClassScheduleVM) => {
  const separatorIndex = schedule.ids.id.indexOf('__');
  return separatorIndex === -1
    ? schedule.ids.id
    : schedule.ids.id.slice(0, separatorIndex);
};

const getDisplayScheduleOccurrenceIdentity = (schedule: DisplayClassScheduleVM) => {
  const baseId = getDisplayScheduleBaseId(schedule);
  const originalStartAt = schedule.uiState?.originalStartAt;

  if (originalStartAt) {
    return `${baseId}|${originalStartAt}`;
  }

  const separatorIndex = schedule.ids.id.indexOf('__');
  if (separatorIndex !== -1) {
    const [, occurrenceKey = schedule.startAt] = schedule.ids.id.split('__');
    return `${baseId}|${occurrenceKey}`;
  }

  return `${baseId}|${schedule.startAt}`;
};

const dedupeExpandedEvents = (schedules: DisplayClassScheduleVM[]) => {
  const deduped = new Map<string, DisplayClassScheduleVM>();

  schedules.forEach((schedule) => {
    const key = getDisplayScheduleOccurrenceIdentity(schedule);
    const existing = deduped.get(key);

    if (
      !existing ||
      getDisplaySchedulePriority(schedule) > getDisplaySchedulePriority(existing)
    ) {
      deduped.set(key, schedule);
    }
  });

  return Array.from(deduped.values());
};

// --- Viewer-local calendar range model -------------------------------------
//
// Calendar ranges are expressed as viewer-local `YYYY-MM-DD` keys rather than
// `Date` midnights. A `Date` carries an instant, so any midnight built from it
// is a *runtime* midnight; comparing occurrences against it makes the calendar
// depend on the machine timezone instead of the viewer's. Day keys remove the
// instant from the comparison entirely.

/** Applies the documented viewer -> schedule -> browser -> UTC fallback chain. */
const resolveViewerTimeZone = (viewerTimezone?: string | null) =>
  resolveScheduleDisplayTimeZone({ viewerTimezone });

const toRuntimeDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const toViewerDayKey = (value: Date | string, viewerTimezone: string) =>
  getScheduleDisplayDayKey(value, viewerTimezone) ??
  toRuntimeDayKey(value instanceof Date ? value : new Date(value));

const addDaysToDayKey = (dayKey: string, days: number) =>
  toDateKey(new Date(parseDateKey(dayKey).getTime() + days * 24 * 60 * 60 * 1000));

const getWeekdayIndexFromDateKey = (dayKey: string) => parseDateKey(dayKey).getUTCDay();

/** Weeks start on Monday, matching `getWeekDays`. */
const getViewerWeekStartKey = (dayKey: string) => {
  const weekday = getWeekdayIndexFromDateKey(dayKey);
  return addDaysToDayKey(dayKey, -(weekday === 0 ? 6 : weekday - 1));
};

const isDayKeyWithinRange = (
  dayKey: string,
  rangeStartKey: string,
  rangeEndKey: string,
) => dayKey >= rangeStartKey && dayKey <= rangeEndKey;

/**
 * Offsets span UTC-12 to UTC+14, so a viewer day boundary can sit up to 26
 * hours away from the same boundary in the schedule timezone. Padding the
 * schedule-local iteration window by two days guarantees that occurrences
 * which cross a viewer date boundary are still generated before the final
 * viewer-key filter decides whether they belong in the range.
 */
const ITERATION_PADDING_DAYS = 2;

const toScheduleDayKeyFromViewerDayKey = (
  viewerDayKey: string,
  viewerTimezone: string,
  scheduleTimezone: string,
  edge: 'start' | 'end',
) => {
  const iso = toUtcFromLocal(
    viewerDayKey,
    edge === 'start' ? '00:00' : '23:59',
    viewerTimezone,
  );
  if (!iso) {
    return viewerDayKey;
  }
  return getLocalDate(iso, scheduleTimezone) ?? viewerDayKey;
};

const getMinDate = (dates: Date[]) =>
  dates.reduce((min, current) => (current < min ? current : min), dates[0]!);

const getMaxDate = (dates: Date[]) =>
  dates.reduce((max, current) => (current > max ? current : max), dates[0]!);

export const expandRecurringEvents = (
  events: ClassScheduleVM[],
  rangeStart: Date,
  rangeEnd: Date,
  viewerTimezone?: string | null,
) => {
  const resolvedViewerTimezone = resolveViewerTimeZone(viewerTimezone);
  return expandRecurringEventsForDayKeyRange(
    events,
    toViewerDayKey(rangeStart, resolvedViewerTimezone),
    toViewerDayKey(rangeEnd, resolvedViewerTimezone),
    resolvedViewerTimezone,
  );
};

const expandRecurringEventsForDayKeyRange = (
  events: ClassScheduleVM[],
  rangeStartKey: string,
  rangeEndKey: string,
  viewerTimezone: string,
) => {
  const expanded: DisplayClassScheduleVM[] = [];

  events.forEach((event) => {
    if (!event.recurrence) {
      if (
        isDayKeyWithinRange(
          toViewerDayKey(event.startAt, viewerTimezone),
          rangeStartKey,
          rangeEndKey,
        )
      ) {
        const isCancelled = event.status === 'cancelled';
        expanded.push({
          ...event,
          meetingLink: isCancelled ? null : event.meetingLink,
          uiState: isCancelled
            ? {
                kind: 'exception',
                disabled: true,
                reason: event.description ?? null,
                originalStartAt: event.startAt,
                originalEndAt: event.endAt,
              }
            : { kind: 'default' },
        });
      }
      return;
    }

    const recurrence = event.recurrence;
    const rule = recurrence.rule;
    const interval = rule.interval ?? 1;
    const scheduleTimezone = getScheduleTimezone(event);
    const baseStart = new Date(event.startAt);
    const baseLocalDate =
      getLocalDate(event.startAt, scheduleTimezone) ?? event.startAt.slice(0, 10);
    const baseLocalTime = getLocalTime(event.startAt, scheduleTimezone) ?? '00:00';
    const durationMs = new Date(event.endAt).getTime() - baseStart.getTime();
    const exceptions = new Set(
      recurrence.exceptions?.map((exception) => exception.occurrenceKey) ?? [],
    );
    const exceptionsByDay = new Set(
      recurrence.exceptions?.map((exception) =>
        getScheduleLocalDayKey(exception.occurrenceKey, event),
      ) ?? [],
    );
    const overrides = new Map(
      recurrence.overrides?.map((override) => [override.occurrenceKey, override.patch]) ??
        [],
    );
    const overridesByDay = new Map(
      recurrence.overrides?.map((override) => [
        getScheduleLocalDayKey(override.occurrenceKey, event),
        override.patch,
      ]) ?? [],
    );
    const byWeekday = rule.byWeekday?.length
      ? rule.byWeekday
      : [getWeekdayTokenFromDateKey(baseLocalDate)];
    const overrideOriginalDates =
      recurrence.overrides?.map((override) =>
        getScheduleLocalDayKey(override.occurrenceKey, event),
      ) ?? [];
    const overridePatchedDates =
      recurrence.overrides
        ?.map((override) =>
          override.patch.startAt
            ? getScheduleLocalDayKey(override.patch.startAt, event)
            : null,
        )
        .filter((date): date is string => Boolean(date)) ?? [];
    const exceptionDates =
      recurrence.exceptions?.map((exception) =>
        getScheduleLocalDayKey(exception.occurrenceKey, event),
      ) ?? [];
    // Translate the viewer range into the schedule timezone and pad it, so a
    // viewer Sunday that is still Saturday in the schedule timezone (or vice
    // versa) cannot end iteration before the occurrence is generated.
    const rangeStartLocalDate = addDaysToDayKey(
      toScheduleDayKeyFromViewerDayKey(
        rangeStartKey,
        viewerTimezone,
        scheduleTimezone,
        'start',
      ),
      -ITERATION_PADDING_DAYS,
    );
    const rangeEndLocalDate = addDaysToDayKey(
      toScheduleDayKeyFromViewerDayKey(
        rangeEndKey,
        viewerTimezone,
        scheduleTimezone,
        'end',
      ),
      ITERATION_PADDING_DAYS,
    );
    const iterationStart = getMinDate(
      [
        parseDateKey(baseLocalDate),
        parseDateKey(rangeStartLocalDate),
        ...overrideOriginalDates,
        ...exceptionDates,
      ].map((value) => (typeof value === 'string' ? parseDateKey(value) : value)),
    );
    const iterationEnd = getMaxDate(
      [
        parseDateKey(rangeEndLocalDate),
        ...overrideOriginalDates,
        ...overridePatchedDates,
        ...exceptionDates,
      ].map((value) => (typeof value === 'string' ? parseDateKey(value) : value)),
    );

    recurrence.exceptions?.forEach((exception) => {
      const originalStart = new Date(exception.occurrenceKey);

      const occurrenceDayKey = getScheduleLocalDayKey(exception.occurrenceKey, event);
      if (overrides.has(exception.occurrenceKey) || overridesByDay.has(occurrenceDayKey))
        return;

      const originalEnd = new Date(originalStart.getTime() + durationMs);

      expanded.push({
        ...event,
        ids: {
          ...event.ids,
          id: `${event.ids.id}__${exception.occurrenceKey}__exception`,
        },
        startAt: originalStart.toISOString(),
        endAt: originalEnd.toISOString(),
        status: 'cancelled',
        meetingLink: null,
        recurrence: undefined,
        description: exception.reason ?? event.description ?? null,
        uiState: {
          kind: 'exception',
          disabled: true,
          reason: exception.reason ?? null,
          originalStartAt: originalStart.toISOString(),
          originalEndAt: originalEnd.toISOString(),
        },
      });
    });

    let occurrenceCount = 0;
    const until = rule.until
      ? (getLocalDate(rule.until, scheduleTimezone) ?? rule.until.slice(0, 10))
      : null;

    for (
      let current = iterationStart;
      current <= iterationEnd;
      current = addDays(current, 1)
    ) {
      const currentLocalDate = toDateKey(current);
      if (currentLocalDate < baseLocalDate) continue;
      if (until && currentLocalDate > until) break;

      const diffDays = getDateDiffInDays(currentLocalDate, baseLocalDate);

      let matches = false;
      if (rule.frequency === 'daily') {
        matches = diffDays % interval === 0;
      } else if (rule.frequency === 'weekly') {
        const weeksDiff = Math.floor(diffDays / 7);
        matches =
          weeksDiff % interval === 0 &&
          byWeekday.includes(getWeekdayTokenFromDateKey(currentLocalDate));
      }

      const occurrenceKey =
        toUtcFromLocal(currentLocalDate, baseLocalTime, scheduleTimezone) ??
        (() => {
          const occurrenceStart = new Date(current);
          occurrenceStart.setHours(
            baseStart.getHours(),
            baseStart.getMinutes(),
            baseStart.getSeconds(),
            baseStart.getMilliseconds(),
          );
          return occurrenceStart.toISOString();
        })();
      const occurrenceStart = new Date(occurrenceKey);
      const occurrenceDayKey = currentLocalDate;
      const override =
        overrides.get(occurrenceKey) ?? overridesByDay.get(occurrenceDayKey);
      const hasOverride = Boolean(override);

      if (!matches && !hasOverride) continue;
      if (
        (exceptions.has(occurrenceKey) || exceptionsByDay.has(occurrenceDayKey)) &&
        !hasOverride
      )
        continue;

      if (rule.count && occurrenceCount >= rule.count) break;

      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      const occurrence: DisplayClassScheduleVM = {
        ...event,
        ...override,
        ids: {
          ...event.ids,
          id: `${event.ids.id}__${occurrenceKey}`,
        },
        startAt: override?.startAt ?? occurrenceStart.toISOString(),
        endAt: override?.endAt ?? occurrenceEnd.toISOString(),
        status: override?.status ?? (hasOverride ? 'rescheduled' : event.status),
        // Keep the parent recurrence so the header can show the recurrence label and
        // resolve the schedule timezone. Exceptions strip it (see above) because they
        // are cancelled/skipped one-off slots where the series label is misleading.
        recurrence: event.recurrence,
        uiState: hasOverride
          ? {
              kind: 'override',
              reason:
                typeof override?.description === 'string'
                  ? override.description
                  : typeof (override as { reason?: unknown } | undefined)?.reason ===
                      'string'
                    ? ((override as { reason?: string }).reason ?? null)
                    : null,
              originalStartAt: occurrenceStart.toISOString(),
              originalEndAt: occurrenceEnd.toISOString(),
            }
          : { kind: 'default' },
      };

      expanded.push(occurrence);
      occurrenceCount += 1;
    }
  });

  return applyArchiveCutoffToDisplaySchedules(
    dedupeExpandedEvents(expanded).filter((schedule) =>
      isDayKeyWithinRange(
        toViewerDayKey(schedule.startAt, viewerTimezone),
        rangeStartKey,
        rangeEndKey,
      ),
    ),
  );
};

/** Builds a `YYYY-MM-DD` key for the first day of a month offset from `dayKey`. */
const getMonthBoundaryKey = (
  dayKey: string,
  monthOffset: number,
  edge: 'start' | 'end',
) => {
  const [year = 1970, month = 1] = dayKey.split('-').map(Number);
  const anchor =
    edge === 'start'
      ? new Date(Date.UTC(year, month - 1 + monthOffset, 1, 12))
      : new Date(Date.UTC(year, month + monthOffset, 0, 12));
  return toDateKey(anchor);
};

export const getClassScheduleEventsForView = (
  events: ClassScheduleVM[],
  currentDate: Date,
  view: ClassScheduleViewVM,
  viewerTimezone?: string | null,
) => {
  const resolvedViewerTimezone = resolveViewerTimeZone(viewerTimezone);
  const currentDayKey = toViewerDayKey(currentDate, resolvedViewerTimezone);
  const rangeStartKey =
    view === 'week' ? getViewerWeekStartKey(currentDayKey) : currentDayKey;
  const rangeEndKey = view === 'week' ? addDaysToDayKey(rangeStartKey, 6) : currentDayKey;
  return expandRecurringEventsForDayKeyRange(
    events,
    rangeStartKey,
    rangeEndKey,
    resolvedViewerTimezone,
  );
};

export const getClassScheduleEventsForMonth = (
  events: ClassScheduleVM[],
  currentDate: Date,
  viewerTimezone?: string | null,
) => {
  const resolvedViewerTimezone = resolveViewerTimeZone(viewerTimezone);
  const currentDayKey = toViewerDayKey(currentDate, resolvedViewerTimezone);
  return expandRecurringEventsForDayKeyRange(
    events,
    getMonthBoundaryKey(currentDayKey, 0, 'start'),
    getMonthBoundaryKey(currentDayKey, 0, 'end'),
    resolvedViewerTimezone,
  );
};

export const getClassScheduleEventsForMonthRange = (
  events: ClassScheduleVM[],
  currentDate: Date,
  monthsBefore = 1,
  monthsAfter = 1,
  viewerTimezone?: string | null,
) => {
  const resolvedViewerTimezone = resolveViewerTimeZone(viewerTimezone);
  const currentDayKey = toViewerDayKey(currentDate, resolvedViewerTimezone);
  return expandRecurringEventsForDayKeyRange(
    events,
    getMonthBoundaryKey(currentDayKey, -monthsBefore, 'start'),
    getMonthBoundaryKey(currentDayKey, monthsAfter, 'end'),
    resolvedViewerTimezone,
  );
};

export const isEventLive = (event: ClassScheduleVM): boolean => {
  const now = new Date();
  const startTime = new Date(event.startAt);
  const endTime = new Date(event.endAt);

  return now >= startTime && now <= endTime;
};
