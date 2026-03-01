import type {
  ClassScheduleVM,
  ClassScheduleViewVM,
  WeekdayVM,
} from '@iconicedu/shared-types';

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

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatEventTime(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getEventDate(event: ClassScheduleVM): Date {
  return new Date(event.startAt);
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

export function timeToMinutes(isoTime: string): number {
  const date = new Date(isoTime);
  return date.getHours() * 60 + date.getMinutes();
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

export function getEventLayout(events: ClassScheduleVM[]) {
  const sorted = [...events].sort((a, b) => {
    const aStart = timeToMinutes(a.startAt);
    const bStart = timeToMinutes(b.startAt);
    if (aStart !== bStart) return aStart - bStart;
    return timeToMinutes(a.endAt) - timeToMinutes(b.endAt);
  });

  const clusters: ClassScheduleVM[][] = [];
  let currentCluster: ClassScheduleVM[] = [];
  let currentEnd = -1;

  sorted.forEach((event) => {
    const start = timeToMinutes(event.startAt);
    const end = timeToMinutes(event.endAt);

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
      const start = timeToMinutes(event.startAt);
      const end = timeToMinutes(event.endAt);
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

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const weekdayTokens: WeekdayVM[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const getOccurrenceDayKey = (isoDateTime: string) => isoDateTime.slice(0, 10);

const isWithinRange = (date: Date, rangeStart: Date, rangeEnd: Date) => {
  const day = startOfDay(date).getTime();
  return day >= rangeStart.getTime() && day <= rangeEnd.getTime();
};

const getWeekStart = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  return startOfDay(start);
};

const getMonthRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: startOfDay(start), end: startOfDay(end) };
};

export const expandRecurringEvents = (
  events: ClassScheduleVM[],
  rangeStart: Date,
  rangeEnd: Date,
) => {
  const expanded: ClassScheduleVM[] = [];
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = startOfDay(rangeEnd);

  events.forEach((event) => {
    if (!event.recurrence) {
      const eventDate = startOfDay(new Date(event.startAt));
      if (isWithinRange(eventDate, rangeStartDay, rangeEndDay)) {
        expanded.push(event);
      }
      return;
    }

    const recurrence = event.recurrence;
    const rule = recurrence.rule;
    const interval = rule.interval ?? 1;
    const baseStart = new Date(event.startAt);
    const baseDate = startOfDay(baseStart);
    const durationMs = new Date(event.endAt).getTime() - baseStart.getTime();
    const exceptions = new Set(
      recurrence.exceptions?.map((exception) => exception.occurrenceKey) ?? [],
    );
    const exceptionsByDay = new Set(
      recurrence.exceptions?.map((exception) => getOccurrenceDayKey(exception.occurrenceKey)) ??
        [],
    );
    const overrides = new Map(
      recurrence.overrides?.map((override) => [override.occurrenceKey, override.patch]) ??
        [],
    );
    const overridesByDay = new Map(
      recurrence.overrides?.map((override) => [
        getOccurrenceDayKey(override.occurrenceKey),
        override.patch,
      ]) ?? [],
    );
    const byWeekday = rule.byWeekday?.length
      ? rule.byWeekday
      : [weekdayTokens[baseDate.getDay()]];

    let occurrenceCount = 0;
    const until = rule.until ? startOfDay(new Date(rule.until)) : null;

    for (
      let current = rangeStartDay;
      current <= rangeEndDay;
      current = addDays(current, 1)
    ) {
      if (current < baseDate) continue;
      if (until && current > until) break;

      const diffDays =
        (startOfDay(current).getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000);

      let matches = false;
      if (rule.frequency === 'daily') {
        matches = diffDays % interval === 0;
      } else if (rule.frequency === 'weekly') {
        const weeksDiff = Math.floor(diffDays / 7);
        matches =
          weeksDiff % interval === 0 &&
          byWeekday.includes(weekdayTokens[current.getDay()]);
      }

      const occurrenceStart = new Date(current);
      occurrenceStart.setHours(
        baseStart.getHours(),
        baseStart.getMinutes(),
        baseStart.getSeconds(),
        baseStart.getMilliseconds(),
      );
      const occurrenceKey = occurrenceStart.toISOString();
      const occurrenceDayKey = getOccurrenceDayKey(occurrenceKey);
      const override = overrides.get(occurrenceKey) ?? overridesByDay.get(occurrenceDayKey);
      const hasOverride = Boolean(override);

      if (!matches && !hasOverride) continue;
      if ((exceptions.has(occurrenceKey) || exceptionsByDay.has(occurrenceDayKey)) && !hasOverride)
        continue;

      if (rule.count && occurrenceCount >= rule.count) break;

      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      const occurrence: ClassScheduleVM = {
        ...event,
        ...override,
        ids: {
          ...event.ids,
          id: `${event.ids.id}__${occurrenceKey}`,
        },
        startAt: override?.startAt ?? occurrenceStart.toISOString(),
        endAt: override?.endAt ?? occurrenceEnd.toISOString(),
        recurrence: undefined,
      };

      expanded.push(occurrence);
      occurrenceCount += 1;
    }
  });

  return expanded;
};

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
