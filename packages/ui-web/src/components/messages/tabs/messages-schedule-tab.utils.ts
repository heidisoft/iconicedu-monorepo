import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { expandRecurringEvents } from '@iconicedu/ui-web/lib/class-schedule-utils';

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

function dedupeDisplaySchedules(schedules: DisplaySchedule[]) {
  const deduped = new Map<string, DisplaySchedule>();

  schedules.forEach((schedule) => {
    const key = `${getDisplayScheduleBaseId(schedule)}|${schedule.startAt.slice(0, 10)}`;
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

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const shortWeekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});
const monthDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});
const getOccurrenceDayKey = (isoDateTime: string) => isoDateTime.slice(0, 10);

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
        getOccurrenceDayKey(item.occurrenceKey) === getOccurrenceDayKey(occurrenceKey),
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

  return dedupeDisplaySchedules([...normalizedNonRecurring, ...normalizedRecurring]);
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

export function formatScheduleDateTime(schedule: ClassScheduleVM): string {
  const start = new Date(schedule.startAt);
  const end = new Date(schedule.endAt);
  return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

export function formatScheduleTimeBadge(schedule: ClassScheduleVM): string {
  return timeFormatter.format(new Date(schedule.startAt));
}

export function formatScheduleDayBadge(
  schedule: ClassScheduleVM,
  now = new Date(),
): string {
  const start = new Date(schedule.startAt);
  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  ).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (startDay === nowDay) return 'Today';
  return shortWeekdayFormatter.format(start);
}

export function formatScheduleDateBadge(schedule: ClassScheduleVM): string {
  return monthDayFormatter.format(new Date(schedule.startAt));
}

export function formatScheduleDayTimeMeta(schedule: ClassScheduleVM): string {
  const start = new Date(schedule.startAt);
  return `${weekdayFormatter.format(start)} • ${formatScheduleDateTime(schedule)}`;
}

export function formatScheduleWeekTitle(schedule: ClassScheduleVM): string {
  const start = new Date(schedule.startAt);
  const weekNumber = Math.min(5, Math.floor((start.getDate() - 1) / 7) + 1);
  return `${monthFormatter.format(start)} · Week ${weekNumber}`;
}

function getCalendarWeekOfMonth(date: Date): number {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeekdayOffset = firstDayOfMonth.getDay();
  return Math.floor((date.getDate() + firstWeekdayOffset - 1) / 7) + 1;
}

function formatCompactMeridiemTime(date: Date): string {
  return timeFormatter.format(date).replace(' AM', 'am').replace(' PM', 'pm');
}

export function getScheduleMonthKey(schedule: ClassScheduleVM): string {
  const start = new Date(schedule.startAt);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
}

export function formatScheduleMonthTitleFromKey(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const monthDate = new Date(year, month - 1, 1);
  return monthYearFormatter.format(monthDate);
}

export function groupSchedulesByMonth(
  schedules: DisplaySchedule[],
): MonthScheduleGroup[] {
  const map = new Map<string, DisplaySchedule[]>();

  schedules.forEach((schedule) => {
    const monthKey = getScheduleMonthKey(schedule);
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
): MonthGroup[] {
  const nowMs = now.getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return groups.map((group) => {
    const [year, month] = group.monthKey.split('-');
    const monthDate = new Date(Number(year), Number(month) - 1, 1);
    const sessionCountByWeekNumber = new Map<number, number>();
    const sessions: ClassSession[] = group.schedules.map((schedule) => {
      const start = new Date(schedule.startAt);
      const end = new Date(schedule.endAt);
      const startDay = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
      ).getTime();
      const weekNumber = getCalendarWeekOfMonth(start);
      const nextSessionNumber = (sessionCountByWeekNumber.get(weekNumber) ?? 0) + 1;
      sessionCountByWeekNumber.set(weekNumber, nextSessionNumber);
      return {
        id: schedule.ids.id,
        label: `${monthFormatter.format(start)} · Week ${weekNumber} · Session ${nextSessionNumber}`,
        time: `${shortWeekdayFormatter.format(start)} ${formatCompactMeridiemTime(start)}`,
        dayName: shortWeekdayFormatter.format(start),
        dayNum: String(start.getDate()),
        isToday: startDay === nowDay,
        isLive: start.getTime() <= nowMs && nowMs < end.getTime(),
        isPast: end.getTime() < nowMs,
        endAt: schedule.endAt,
        status: schedule.status,
        meetingLink: schedule.meetingLink ?? null,
        variant: schedule.uiState?.kind ?? 'default',
        disabled: schedule.uiState?.disabled ?? false,
        reason: schedule.uiState?.reason ?? null,
        originalTime: schedule.uiState?.originalStartAt
          ? formatScheduleDateTime({
              ...schedule,
              startAt: schedule.uiState.originalStartAt,
              endAt: schedule.uiState.originalEndAt ?? schedule.uiState.originalStartAt,
            })
          : null,
        originalDate: schedule.uiState?.originalStartAt
          ? formatScheduleDateBadge({
              ...schedule,
              startAt: schedule.uiState.originalStartAt,
            })
          : null,
      };
    });

    return {
      monthKey: group.monthKey,
      month: monthDate.toLocaleDateString('en-US', { month: 'long' }),
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
): Map<string, MonthProgressStats> {
  const statsByMonthKey = new Map<string, MonthProgressStats>();

  schedules.forEach((schedule) => {
    const monthKey = getScheduleMonthKey(schedule);
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
