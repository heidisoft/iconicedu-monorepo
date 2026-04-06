import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { getLocalDate } from '@iconicedu/utils';
import { expandRecurringEvents } from '@iconicedu/ui-web/lib/class-schedule-utils';
import {
  formatScheduleDisplayTimeWithZone,
  formatScheduleDisplayValue,
  getScheduleDisplayTimeZoneAbbreviation,
  getScheduleDisplayMonthKey,
  resolveScheduleDisplayTimeZone,
  type ScheduleDisplayTimeZoneInput,
  toScheduleDisplayDate,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';

export type ScheduleSubTabKey = 'upcoming' | 'past';

export interface ScheduleBuckets {
  upcoming: DisplaySchedule[];
  past: DisplaySchedule[];
}

export interface MonthScheduleGroup {
  monthKey: string;
  monthTitle: string;
  schedules: DisplaySchedule[];
}

export interface DisplaySchedule extends ClassScheduleVM {
  uiState?: {
    kind?: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
}

function getScheduleDisplayTimezoneInput(
  schedule: Pick<DisplaySchedule, 'timezone' | 'recurrence'>,
  viewerTimezone?: string | null,
): ScheduleDisplayTimeZoneInput {
  return {
    viewerTimezone,
    scheduleTimezone: schedule.timezone ?? schedule.recurrence?.rule.timezone ?? null,
  };
}

function startOfDisplayDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfDisplayWeekMonday(date: Date) {
  const result = startOfDisplayDay(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export function getScheduleDisplayStartOfDay(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  const displayDate = toScheduleDisplayDate(input, timezone) ?? new Date(input);
  return startOfDisplayDay(displayDate);
}

export function getScheduleDisplayStartOfWeek(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  return startOfDisplayWeekMonday(getScheduleDisplayStartOfDay(input, timezone));
}

export function getResolvedScheduleDisplayMonthKey(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
) {
  return getScheduleDisplayMonthKey(input, timezone) ?? '1970-01';
}

function getDisplaySchedulePriority(schedule: DisplaySchedule) {
  if (schedule.uiState?.kind === 'exception') return 3;
  if (schedule.uiState?.kind === 'override') return 2;
  return 1;
}

function getDisplayScheduleBaseId(schedule: DisplaySchedule) {
  const separatorIndex = schedule.ids.id.indexOf('__');
  return separatorIndex === -1
    ? schedule.ids.id
    : schedule.ids.id.slice(0, separatorIndex);
}

function getDisplayScheduleOccurrenceIdentity(schedule: DisplaySchedule) {
  const baseId = getDisplayScheduleBaseId(schedule);

  if (schedule.uiState?.originalStartAt) {
    return `${baseId}|${schedule.uiState.originalStartAt}`;
  }

  const separatorIndex = schedule.ids.id.indexOf('__');
  if (separatorIndex !== -1) {
    const [, occurrenceKey = schedule.startAt] = schedule.ids.id.split('__');
    return `${baseId}|${occurrenceKey}`;
  }

  return `${baseId}|${schedule.startAt}`;
}

function dedupeDisplaySchedules(
  schedules: DisplaySchedule[],
  recurringById?: Map<string, ClassScheduleVM>,
) {
  const dedupedByOccurrence = new Map<string, DisplaySchedule>();

  schedules.forEach((schedule) => {
    const key = getDisplayScheduleOccurrenceIdentity(schedule);
    const existing = dedupedByOccurrence.get(key);

    if (
      !existing ||
      getDisplaySchedulePriority(schedule) > getDisplaySchedulePriority(existing)
    ) {
      dedupedByOccurrence.set(key, schedule);
    }
  });

  if (!recurringById) {
    return Array.from(dedupedByOccurrence.values());
  }

  const dedupedByDay = new Map<string, DisplaySchedule>();

  dedupedByOccurrence.forEach((schedule) => {
    const baseId = getDisplayScheduleBaseId(schedule);
    const baseSchedule = recurringById.get(baseId);
    const shouldDedupeByDay = baseSchedule?.recurrence?.rule.frequency === 'daily';

    if (!shouldDedupeByDay) {
      dedupedByDay.set(getDisplayScheduleOccurrenceIdentity(schedule), schedule);
      return;
    }

    const key = `${baseId}|${getOccurrenceDayKey(schedule.startAt, baseSchedule)}`;
    const existing = dedupedByDay.get(key);

    if (!existing) {
      dedupedByDay.set(key, schedule);
      return;
    }

    const schedulePriority = getDisplaySchedulePriority(schedule);
    const existingPriority = getDisplaySchedulePriority(existing);

    if (schedulePriority > existingPriority) {
      dedupedByDay.set(key, schedule);
      return;
    }

    if (
      schedulePriority === existingPriority &&
      new Date(schedule.startAt).getTime() < new Date(existing.startAt).getTime()
    ) {
      dedupedByDay.set(key, schedule);
    }
  });

  return Array.from(dedupedByDay.values());
}

export interface ClassSession {
  id: string;
  label: string;
  time: string;
  dayName: string;
  dayNum: string;
  isToday: boolean;
  isLive: boolean;
  isPast: boolean;
  endAt: string;
  status: ClassScheduleVM['status'];
  meetingLink?: string | null;
  variant?: 'default' | 'exception' | 'override';
  disabled?: boolean;
  reason?: string | null;
  originalTime?: string | null;
  originalDate?: string | null;
}

export interface MonthGroup {
  monthKey: string;
  month: string;
  year: string;
  totalCount: number;
  completedCount: number;
  sessions: ClassSession[];
}

export interface MonthProgressStats {
  scheduledCount: number;
  completedCount: number;
}

function isScheduleCompletedForProgress(schedule: DisplaySchedule, now: Date): boolean {
  if (schedule.status === 'completed') {
    return true;
  }

  if (schedule.status === 'cancelled') {
    return false;
  }

  return new Date(schedule.endAt).getTime() < now.getTime();
}

const getOccurrenceDayKey = (
  isoDateTime: string,
  schedule: Pick<DisplaySchedule, 'timezone' | 'recurrence'>,
) => {
  const timezone = schedule.timezone ?? schedule.recurrence?.rule.timezone ?? 'UTC';
  return getLocalDate(isoDateTime, timezone) ?? isoDateTime.slice(0, 10);
};

function getRecurringDisplayRange(schedules: ClassScheduleVM[], now: Date) {
  const recurringSchedules = schedules.filter((schedule) => Boolean(schedule.recurrence));
  const earliestRecurringStart = recurringSchedules.reduce<Date | null>(
    (currentMin, schedule) => {
      const start = new Date(schedule.startAt);
      if (!currentMin || start < currentMin) return start;
      return currentMin;
    },
    null,
  );
  const defaultRangeStart = new Date(now);
  defaultRangeStart.setFullYear(defaultRangeStart.getFullYear() - 1);

  const latestKnownEnd = schedules.reduce<Date | null>((currentMax, schedule) => {
    const untilValue = schedule.recurrence?.rule.until;
    const candidate = untilValue ? new Date(untilValue) : null;
    if (!candidate) return currentMax;
    if (!currentMax || candidate > currentMax) return candidate;
    return currentMax;
  }, null);
  const defaultRangeEnd = new Date(now);
  defaultRangeEnd.setFullYear(defaultRangeEnd.getFullYear() + 2);

  return {
    rangeStart: earliestRecurringStart ?? defaultRangeStart,
    rangeEnd: latestKnownEnd ?? defaultRangeEnd,
  };
}

export function expandSchedulesForDisplay(
  schedules: ClassScheduleVM[],
  now = new Date(),
): DisplaySchedule[] {
  const recurring = schedules.filter((schedule) => schedule.recurrence);
  const nonRecurring = schedules.filter((schedule) => !schedule.recurrence);
  const normalizedNonRecurring: DisplaySchedule[] = nonRecurring.map((schedule) => ({
    ...schedule,
    description: null,
    uiState: { kind: 'default' },
  }));
  if (!recurring.length) {
    return normalizedNonRecurring;
  }

  const { rangeStart, rangeEnd } = getRecurringDisplayRange(schedules, now);
  const expandedRecurring = expandRecurringEvents(recurring, rangeStart, rangeEnd);
  const recurringById = new Map(recurring.map((item) => [item.ids.id, item]));
  const normalizedRecurring: DisplaySchedule[] = expandedRecurring.map((schedule) => {
    if (schedule.uiState?.kind) {
      return {
        ...schedule,
        description:
          schedule.uiState.kind === 'exception'
            ? (schedule.uiState.reason ?? schedule.description ?? null)
            : null,
        uiState: schedule.uiState,
      };
    }

    const compositeId = schedule.ids.id;
    const separatorIndex = compositeId.indexOf('__');
    if (separatorIndex === -1) {
      return { ...schedule, description: null, uiState: { kind: 'default' } };
    }

    const baseId = compositeId.slice(0, separatorIndex);
    const occurrenceKey = compositeId.slice(separatorIndex + 2);
    const baseSchedule = recurringById.get(baseId);
    const override = baseSchedule?.recurrence?.overrides?.find(
      (item) =>
        item.occurrenceKey === occurrenceKey ||
        getOccurrenceDayKey(item.occurrenceKey, baseSchedule ?? schedule) ===
          getOccurrenceDayKey(occurrenceKey, baseSchedule ?? schedule),
    );
    const originalStartAt = occurrenceKey;
    const durationMs = baseSchedule
      ? new Date(baseSchedule.endAt).getTime() - new Date(baseSchedule.startAt).getTime()
      : 0;
    const originalEndAt = durationMs
      ? new Date(new Date(originalStartAt).getTime() + durationMs).toISOString()
      : undefined;

    return {
      ...schedule,
      description: null,
      uiState: override
        ? {
            kind: 'override',
            originalStartAt,
            originalEndAt,
          }
        : { kind: 'default' },
    };
  });

  return dedupeDisplaySchedules(
    [...normalizedNonRecurring, ...normalizedRecurring],
    recurringById,
  );
}

export function splitSchedulesByTimeline(
  schedules: ClassScheduleVM[],
  now = new Date(),
): ScheduleBuckets {
  const expandedSchedules = expandSchedulesForDisplay(schedules, now);
  const nowMs = now.getTime();
  const upcoming: DisplaySchedule[] = [];
  const past: DisplaySchedule[] = [];

  expandedSchedules.forEach((schedule) => {
    const endMs = new Date(schedule.endAt).getTime();
    if (endMs >= nowMs) {
      upcoming.push(schedule);
      return;
    }
    past.push(schedule);
  });

  upcoming.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  return { upcoming, past };
}

export function formatScheduleStatus(status: ClassScheduleVM['status']): string {
  if (status === 'rescheduled') return 'Rescheduled';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'completed') return 'Completed';
  return 'Scheduled';
}

export function formatScheduleDateTime(
  schedule: ClassScheduleVM,
  timezone?: string | null,
): string {
  const displayTimezone = getScheduleDisplayTimezoneInput(schedule, timezone);
  const start =
    formatScheduleDisplayValue(schedule.startAt, displayTimezone, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) ?? '';
  const end =
    formatScheduleDisplayValue(schedule.endAt, displayTimezone, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) ?? '';
  const abbreviation = getScheduleDisplayTimeZoneAbbreviation(
    schedule.endAt,
    displayTimezone,
  );
  return abbreviation ? `${start} - ${end} ${abbreviation}` : `${start} - ${end}`;
}

export function formatScheduleTimeBadge(
  schedule: ClassScheduleVM,
  timezone?: string | null,
): string {
  return (
    formatScheduleDisplayTimeWithZone(
      schedule.startAt,
      getScheduleDisplayTimezoneInput(schedule, timezone),
      {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      },
    ) ?? ''
  );
}

export function formatScheduleDayBadge(
  schedule: ClassScheduleVM,
  now = new Date(),
  timezone?: string | null,
): string {
  const displayTimezone = getScheduleDisplayTimezoneInput(schedule, timezone);
  const startDay = getScheduleDisplayStartOfDay(
    schedule.startAt,
    displayTimezone,
  ).getTime();
  const nowDay = getScheduleDisplayStartOfDay(now, displayTimezone).getTime();
  if (startDay === nowDay) return 'Today';
  return (
    formatScheduleDisplayValue(schedule.startAt, displayTimezone, {
      weekday: 'short',
    }) ?? ''
  );
}

export function formatScheduleDateBadge(
  schedule: ClassScheduleVM,
  timezone?: string | null,
): string {
  return (
    formatScheduleDisplayValue(
      schedule.startAt,
      getScheduleDisplayTimezoneInput(schedule, timezone),
      {
        month: 'short',
        day: 'numeric',
      },
    ) ?? ''
  );
}

export function formatScheduleDayTimeMeta(
  schedule: ClassScheduleVM,
  timezone?: string | null,
): string {
  const displayTimezone = getScheduleDisplayTimezoneInput(schedule, timezone);
  const dayLabel =
    formatScheduleDisplayValue(schedule.startAt, displayTimezone, {
      weekday: 'long',
    }) ?? '';
  return `${dayLabel} • ${formatScheduleDateTime(schedule, timezone)}`;
}

export function formatScheduleWeekTitle(
  schedule: ClassScheduleVM,
  timezone?: string | null,
): string {
  const displayTimezone = getScheduleDisplayTimezoneInput(schedule, timezone);
  const start = getScheduleDisplayStartOfDay(schedule.startAt, displayTimezone);
  const weekNumber = Math.min(5, Math.floor((start.getDate() - 1) / 7) + 1);
  const monthLabel =
    formatScheduleDisplayValue(schedule.startAt, displayTimezone, {
      month: 'short',
    }) ?? '';
  return `${monthLabel} · Week ${weekNumber}`;
}

function getCalendarWeekOfMonth(date: Date): number {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeekdayOffset = firstDayOfMonth.getDay();
  return Math.floor((date.getDate() + firstWeekdayOffset - 1) / 7) + 1;
}

function formatCompactMeridiemTime(
  input: Date | string,
  timezone: ScheduleDisplayTimeZoneInput,
  includeZone = false,
): string {
  const formatted = (
    (includeZone
      ? formatScheduleDisplayTimeWithZone(input, timezone, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : formatScheduleDisplayValue(input, timezone, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })) ?? ''
  )
    .replace(' AM', 'am')
    .replace(' PM', 'pm');

  return formatted;
}

export function getScheduleMonthKey(
  schedule: ClassScheduleVM,
  timezone?: string | null,
): string {
  return getResolvedScheduleDisplayMonthKey(
    schedule.startAt,
    getScheduleDisplayTimezoneInput(schedule, timezone),
  );
}

export function formatScheduleMonthTitleFromKey(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const monthDate = new Date(year, month - 1, 1);
  return (
    formatScheduleDisplayValue(monthDate, null, {
      month: 'long',
      year: 'numeric',
    }) ?? monthKey
  );
}

export function groupSchedulesByMonth(
  schedules: DisplaySchedule[],
  timezone?: string | null,
): MonthScheduleGroup[] {
  const map = new Map<string, DisplaySchedule[]>();

  schedules.forEach((schedule) => {
    const monthKey = getScheduleMonthKey(schedule, timezone);
    const current = map.get(monthKey) ?? [];
    current.push(schedule);
    map.set(monthKey, current);
  });

  return Array.from(map.entries()).map(([monthKey, monthSchedules]) => ({
    monthKey,
    monthTitle: formatScheduleMonthTitleFromKey(monthKey),
    schedules: monthSchedules,
  }));
}

export function takeMonthGroups(
  groups: MonthScheduleGroup[],
  monthLimit: number,
): MonthScheduleGroup[] {
  if (monthLimit <= 0) return [];
  return groups.slice(0, monthLimit);
}

export function toMonthGroups(
  groups: MonthScheduleGroup[],
  now = new Date(),
  timezone?: string | null,
): MonthGroup[] {
  const nowMs = now.getTime();
  const resolvedViewerTimezone = resolveScheduleDisplayTimeZone(timezone);
  const nowDay = getScheduleDisplayStartOfDay(now, resolvedViewerTimezone).getTime();
  return groups.map((group) => {
    const [year, month] = group.monthKey.split('-');
    const monthDate = new Date(Number(year), Number(month) - 1, 1, 12);
    const sessionCountByWeekNumber = new Map<number, number>();
    const sessions: ClassSession[] = group.schedules.map((schedule) => {
      const displayTimezone = getScheduleDisplayTimezoneInput(
        schedule,
        resolvedViewerTimezone,
      );
      const startDisplayDate = getScheduleDisplayStartOfDay(
        schedule.startAt,
        displayTimezone,
      );
      const startDay = startDisplayDate.getTime();
      const weekNumber = getCalendarWeekOfMonth(startDisplayDate);
      const nextSessionNumber = (sessionCountByWeekNumber.get(weekNumber) ?? 0) + 1;
      sessionCountByWeekNumber.set(weekNumber, nextSessionNumber);
      const monthLabel =
        formatScheduleDisplayValue(schedule.startAt, displayTimezone, {
          month: 'short',
        }) ?? '';
      const dayLabel =
        formatScheduleDisplayValue(schedule.startAt, displayTimezone, {
          weekday: 'short',
        }) ?? '';
      return {
        id: schedule.ids.id,
        label: `${monthLabel} · Week ${weekNumber} · Session ${nextSessionNumber}`,
        time: `${dayLabel} ${formatCompactMeridiemTime(
          schedule.startAt,
          displayTimezone,
          true,
        )}`,
        dayName: dayLabel,
        dayNum: String(startDisplayDate.getDate()),
        isToday: startDay === nowDay,
        isLive:
          schedule.status !== 'cancelled' &&
          new Date(schedule.startAt).getTime() <= nowMs &&
          nowMs < new Date(schedule.endAt).getTime(),
        isPast: new Date(schedule.endAt).getTime() < nowMs,
        endAt: schedule.endAt,
        status: schedule.status,
        meetingLink: schedule.meetingLink ?? null,
        variant: schedule.uiState?.kind ?? 'default',
        disabled: schedule.uiState?.disabled ?? false,
        reason: schedule.uiState?.reason ?? null,
        originalTime: schedule.uiState?.originalStartAt
          ? formatScheduleDateTime(
              {
                ...schedule,
                startAt: schedule.uiState.originalStartAt,
                endAt: schedule.uiState.originalEndAt ?? schedule.uiState.originalStartAt,
              },
              resolvedViewerTimezone,
            )
          : null,
        originalDate: schedule.uiState?.originalStartAt
          ? formatScheduleDateBadge(
              {
                ...schedule,
                startAt: schedule.uiState.originalStartAt,
              },
              resolvedViewerTimezone,
            )
          : null,
      };
    });

    return {
      monthKey: group.monthKey,
      month:
        formatScheduleDisplayValue(monthDate, null, {
          month: 'long',
        }) ?? '',
      year,
      totalCount: sessions.length,
      completedCount: sessions.filter((session) => session.status === 'completed').length,
      sessions,
    };
  });
}

export function getJoinableSessionId(schedules: DisplaySchedule[]): string | null {
  const nextJoinable = schedules.find(
    (schedule) => !(schedule.uiState?.disabled ?? false),
  );
  return nextJoinable?.ids.id ?? null;
}

export function getMonthProgressStatsByKey(
  schedules: DisplaySchedule[],
  now = new Date(),
  timezone?: string | null,
): Map<string, MonthProgressStats> {
  const statsByMonthKey = new Map<string, MonthProgressStats>();

  schedules.forEach((schedule) => {
    const monthKey = getScheduleMonthKey(schedule, timezone);
    const current = statsByMonthKey.get(monthKey) ?? {
      scheduledCount: 0,
      completedCount: 0,
    };

    if (schedule.status !== 'cancelled') {
      current.scheduledCount += 1;
    }

    if (isScheduleCompletedForProgress(schedule, now)) {
      current.completedCount += 1;
    }

    statsByMonthKey.set(monthKey, current);
  });

  return statsByMonthKey;
}

export function calculateScheduleCompletionPercent(
  scheduledCount: number,
  completedCount: number,
): number {
  if (scheduledCount <= 0) return 0;
  return Math.round((completedCount / scheduledCount) * 100);
}

export function createGoogleCalendarUrl(schedule: ClassScheduleVM): string {
  const start = new Date(schedule.startAt)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const end = new Date(schedule.endAt)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: schedule.title,
    dates: `${start}/${end}`,
    details: schedule.description ?? '',
    location: schedule.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
