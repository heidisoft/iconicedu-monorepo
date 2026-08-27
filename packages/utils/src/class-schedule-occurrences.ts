import type {
  ArchiveAwareClassScheduleVM,
  ClassScheduleVM,
  WeekdayVM,
} from '@iconicedu/shared-types';
import { applyArchiveCutoffToDisplaySchedules } from '@iconicedu/shared-types';

import { getLocalDate, getLocalTime, toUtcFromLocal } from './time';

/**
 * Framework-neutral class-schedule occurrence expansion.
 *
 * This is the single source of truth for turning a `ClassScheduleVM` plus its
 * recurrence rules, exceptions, and overrides into concrete occurrences. It lives
 * in `@iconicedu/utils` rather than `@iconicedu/ui-web` so that `apps/api` can
 * authoritatively validate an occurrence identity without importing a UI package.
 *
 * `@iconicedu/ui-web` re-exports these symbols, so web display code keeps its
 * existing import paths.
 */
export type DisplayClassScheduleVM = ArchiveAwareClassScheduleVM;

function getScheduleTimezone(event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>) {
  return event.timezone ?? event.recurrence?.rule.timezone ?? 'UTC';
}

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, days: number) => {
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

const isWithinRange = (date: Date, rangeStart: Date, rangeEnd: Date) => {
  const day = startOfDay(date).getTime();
  return day >= rangeStart.getTime() && day <= rangeEnd.getTime();
};

const getMinDate = (dates: Date[]) =>
  dates.reduce((min, current) => (current < min ? current : min), dates[0]!);

const getMaxDate = (dates: Date[]) =>
  dates.reduce((max, current) => (current > max ? current : max), dates[0]!);

export const getWeekStart = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  return startOfDay(start);
};

export const getMonthRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: startOfDay(start), end: startOfDay(end) };
};

export const expandRecurringEvents = (
  events: ClassScheduleVM[],
  rangeStart: Date,
  rangeEnd: Date,
) => {
  const expanded: DisplayClassScheduleVM[] = [];
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
          override.patch.startAt
            ? getScheduleLocalDayKey(override.patch.startAt, event)
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
      isWithinRange(new Date(schedule.startAt), rangeStartDay, rangeEndDay),
    ),
  );
};

/**
 * Stable identity of one expanded occurrence (issue #195).
 *
 * `occurrenceKey` is the *original* occurrence start — the key recurrence
 * exceptions and overrides are stored against — so a rescheduled occurrence keeps
 * the same identity as the slot it replaced. `scheduleId` is the base schedule,
 * with the `__<occurrenceKey>` suffix `expandRecurringEvents` adds stripped off.
 *
 * Clients send this pair to the API to join one exact occurrence; the API
 * re-expands the schedule and matches on the same pair, so a tampered or guessed
 * combination resolves to nothing.
 */
export function getClassScheduleOccurrenceIdentity(
  schedule: Pick<DisplayClassScheduleVM, 'ids' | 'startAt' | 'uiState'>,
): { scheduleId: string; occurrenceKey: string } {
  const compositeId = schedule.ids.id;
  const separatorIndex = compositeId.indexOf('__');
  const scheduleId =
    separatorIndex === -1 ? compositeId : compositeId.slice(0, separatorIndex);

  const originalStartAt = schedule.uiState?.originalStartAt;
  if (originalStartAt) {
    return { scheduleId, occurrenceKey: originalStartAt };
  }

  if (separatorIndex !== -1) {
    const [, occurrenceKey = schedule.startAt] = compositeId.split('__');
    return { scheduleId, occurrenceKey };
  }

  return { scheduleId, occurrenceKey: schedule.startAt };
}
