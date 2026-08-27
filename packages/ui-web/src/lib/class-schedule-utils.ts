import type {
  ArchiveAwareClassScheduleVM,
  ClassScheduleVM,
  ClassScheduleViewVM,
  RecurrenceVM,
} from '@iconicedu/shared-types';
import {
  addDays,
  expandRecurringEvents,
  getMonthRange,
  getWeekStart,
  startOfDay,
} from '@iconicedu/utils';
import {
  formatScheduleDisplayTimeWithZone,
  formatScheduleDisplayValue,
  getScheduleDisplayDateParts,
  toScheduleDisplayDate,
  getScheduleDisplayMinutes,
  type ScheduleDisplayTimeZoneInput,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';
import { WEEKDAYS } from '@iconicedu/ui-web/lib/recurrence-types';

export type DisplayClassScheduleVM = ArchiveAwareClassScheduleVM;

// Occurrence expansion moved to `@iconicedu/utils` so `apps/api` can validate an
// occurrence identity without importing a UI package (issue #195). Re-exported here
// to keep every existing `@iconicedu/ui-web/lib/class-schedule-utils` import working.
export {
  addDays,
  expandRecurringEvents,
  getMonthRange,
  getWeekStart,
  startOfDay,
} from '@iconicedu/utils';

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

export function formatDayName(date: Date, timezone?: string | null): string {
  return formatScheduleDisplayValue(date, timezone, { weekday: 'short' }) ?? '';
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

export const getClassScheduleEventsForView = (
  events: ClassScheduleVM[],
  currentDate: Date,
  view: ClassScheduleViewVM,
) => {
  const rangeStart =
    view === 'week' ? getWeekStart(currentDate) : startOfDay(currentDate);
  const rangeEnd = view === 'week' ? addDays(rangeStart, 6) : startOfDay(currentDate);
  return expandRecurringEvents(events, rangeStart, rangeEnd);
};

export const getClassScheduleEventsForMonth = (
  events: ClassScheduleVM[],
  currentDate: Date,
) => {
  const { start, end } = getMonthRange(currentDate);
  return expandRecurringEvents(events, start, end);
};

export const getClassScheduleEventsForMonthRange = (
  events: ClassScheduleVM[],
  currentDate: Date,
  monthsBefore = 1,
  monthsAfter = 1,
) => {
  const start = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - monthsBefore,
    1,
  );
  const end = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + monthsAfter + 1,
    0,
  );
  return expandRecurringEvents(events, startOfDay(start), startOfDay(end));
};

export const isEventLive = (event: ClassScheduleVM): boolean => {
  const now = new Date();
  const startTime = new Date(event.startAt);
  const endTime = new Date(event.endAt);

  return now >= startTime && now <= endTime;
};
