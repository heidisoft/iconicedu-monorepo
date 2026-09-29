import type {
  ArchiveAwareClassScheduleVM,
  ClassScheduleVM,
  WeekdayVM,
} from '@iconicedu/shared-types';
import { applyArchiveCutoffToDisplaySchedules } from '@iconicedu/shared-types';
import { getLocalDate, getLocalTime, toUtcFromLocal } from '@iconicedu/utils';
import {
  getScheduleDisplayDayKey,
  resolveScheduleDisplayTimeZone,
} from './schedule-display-timezone';

// This file is a narrow, join-scoped port of the occurrence-expansion core of
// packages/ui-web/src/lib/class-schedule-utils.ts (only `expandRecurringEvents`
// and the private helpers it needs) — apps/api cannot depend on ui-web, whose
// entry point pulls in React component code. Keep in sync with the source if
// the recurrence rules there change.

export type DisplayClassScheduleVM = ArchiveAwareClassScheduleVM;

function getScheduleTimezone(event: Pick<ClassScheduleVM, 'timezone' | 'recurrence'>) {
  return event.timezone ?? event.recurrence?.rule.timezone ?? 'UTC';
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

const weekdayTokens: WeekdayVM[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

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
        // Keep the parent recurrence so callers can resolve the schedule
        // timezone. Exceptions strip it (see above) since they are
        // cancelled/skipped one-off slots.
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
