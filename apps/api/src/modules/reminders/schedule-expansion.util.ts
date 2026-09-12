import type { ClassScheduleVM, WeekdayVM } from '@iconicedu/shared-types';
import type { EventStatusVM } from '@iconicedu/shared-types';
import { getLocalDate, getLocalTime, toUtcFromLocal } from '@iconicedu/utils';

// Pure recurrence-expansion logic shared by RemindersService (compile path) and
// ReminderReconcileService (the path actually exercised at runtime for schedule
// creation/edits, via the async reminder.reconcile DB-trigger chain). Both used
// to carry independent, near-identical copies of this closure — consolidated
// here so a fix only needs to happen once.

export type ExpandedClassSchedule = ClassScheduleVM & {
  uiState?: {
    kind?: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
};

export function normalizeBaseScheduleId(scheduleId: string) {
  const marker = '__';
  const index = scheduleId.indexOf(marker);
  return index === -1 ? scheduleId : scheduleId.slice(0, index);
}

export function getScheduleTimezone(
  event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>,
) {
  return event.timezone ?? event.recurrence?.rule.timezone ?? 'UTC';
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function parseDateKey(value: string) {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number.parseInt(yearText ?? '1970', 10);
  const month = Number.parseInt(monthText ?? '1', 10);
  const day = Number.parseInt(dayText ?? '1', 10);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function getDateDiffInDays(left: string, right: string) {
  return Math.round(
    (parseDateKey(left).getTime() - parseDateKey(right).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

export function getWeekdayTokenFromDateKey(value: string): WeekdayVM {
  const weekday = parseDateKey(value).getUTCDay();
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][weekday] as WeekdayVM;
}

export function getScheduleLocalDayKey(
  isoDateTime: string,
  event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>,
) {
  return (
    getLocalDate(isoDateTime, getScheduleTimezone(event)) ?? isoDateTime.slice(0, 10)
  );
}

export function isWithinRange(date: Date, rangeStart: Date, rangeEnd: Date) {
  const day = startOfDay(date).getTime();
  return day >= rangeStart.getTime() && day <= rangeEnd.getTime();
}

export function getMinDate(dates: Date[]) {
  return dates.reduce((min, current) => (current < min ? current : min), dates[0]!);
}

export function getMaxDate(dates: Date[]) {
  return dates.reduce((max, current) => (current > max ? current : max), dates[0]!);
}

export function getDisplaySchedulePriority(schedule: ExpandedClassSchedule) {
  if (schedule.uiState?.kind === 'exception') return 3;
  if (schedule.uiState?.kind === 'override') return 2;
  return 1;
}

export function getDisplayScheduleOccurrenceIdentity(schedule: ExpandedClassSchedule) {
  const baseId = normalizeBaseScheduleId(schedule.ids.id);
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
}

export function dedupeExpandedEvents(schedules: ExpandedClassSchedule[]) {
  const deduped = new Map<string, ExpandedClassSchedule>();
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
}

/**
 * Expands recurring (and passes through non-recurring) schedules into concrete
 * occurrences within `[rangeStart, rangeEnd]`.
 *
 * A recurring event's own literal base occurrence (the one at its unmodified
 * `event.startAt`, not shifted by an override) is always retained regardless of
 * the range bound, even when it falls outside `[rangeStart, rangeEnd]` — this is
 * the fix for a real bug: converting an existing one-off session into a
 * recurring class copies its `start_at` verbatim onto the new schedule, so that
 * base occurrence is very often already outside any `now`-relative window by the
 * time the edit is saved, silently dropping its reminder/completion-check job
 * while every later occurrence works fine. Callers already have their own
 * eligibility logic for a stale job from here (skip a reminder whose `runAt` has
 * passed; clamp an overdue completion-check to fire at `now`).
 */
export function expandRecurringEvents(
  events: ClassScheduleVM[],
  rangeStart: Date,
  rangeEnd: Date,
): ExpandedClassSchedule[] {
  const expanded: ExpandedClassSchedule[] = [];
  const baseOccurrences = new Set<ExpandedClassSchedule>();
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = startOfDay(rangeEnd);

  events.forEach((event) => {
    if (!event.recurrence) {
      const eventDate = startOfDay(new Date(event.startAt));
      if (isWithinRange(eventDate, rangeStartDay, rangeEndDay)) {
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
          override.patch?.startAt
            ? getScheduleLocalDayKey(override.patch.startAt as string, event)
            : null,
        )
        .filter((date): date is string => Boolean(date)) ?? [];
    const exceptionDates =
      recurrence.exceptions?.map((exception) =>
        getScheduleLocalDayKey(exception.occurrenceKey, event),
      ) ?? [];
    const rangeStartLocalDate =
      getLocalDate(rangeStart.toISOString(), scheduleTimezone) ??
      toDateKey(rangeStartDay);
    const rangeEndLocalDate =
      getLocalDate(rangeEnd.toISOString(), scheduleTimezone) ?? toDateKey(rangeEndDay);
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
      if (
        overrides.has(exception.occurrenceKey) ||
        overridesByDay.has(occurrenceDayKey)
      ) {
        return;
      }
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
      ) {
        continue;
      }
      if (rule.count && occurrenceCount >= rule.count) break;

      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      const occurrenceEntry: ExpandedClassSchedule = {
        ...event,
        ...(override as Partial<ExpandedClassSchedule>),
        ids: { ...event.ids, id: `${event.ids.id}__${occurrenceKey}` },
        startAt:
          (override as { startAt?: string } | undefined)?.startAt ??
          occurrenceStart.toISOString(),
        endAt:
          (override as { endAt?: string } | undefined)?.endAt ??
          occurrenceEnd.toISOString(),
        status:
          ((override as { status?: string } | undefined)?.status as
            | EventStatusVM
            | undefined) ?? (hasOverride ? 'rescheduled' : event.status),
        recurrence: event.recurrence,
        uiState: hasOverride
          ? {
              kind: 'override',
              reason:
                typeof (override as { description?: unknown })?.description === 'string'
                  ? ((override as { description: string }).description ?? null)
                  : typeof (override as { reason?: unknown })?.reason === 'string'
                    ? ((override as { reason: string }).reason ?? null)
                    : null,
              originalStartAt: occurrenceStart.toISOString(),
              originalEndAt: occurrenceEnd.toISOString(),
            }
          : { kind: 'default' },
      };
      expanded.push(occurrenceEntry);
      if (diffDays === 0 && !hasOverride) {
        baseOccurrences.add(occurrenceEntry);
      }
      occurrenceCount += 1;
    }
  });

  return dedupeExpandedEvents(expanded).filter(
    (schedule) =>
      baseOccurrences.has(schedule) ||
      isWithinRange(new Date(schedule.startAt), rangeStartDay, rangeEndDay),
  );
}
