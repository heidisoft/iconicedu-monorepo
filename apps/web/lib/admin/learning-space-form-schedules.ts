import type { LearningSpaceCreatePayload } from '@iconicedu/shared-types';
import type {
  RecurrenceException,
  RecurrenceFormData,
  RecurrenceOverride,
} from '@iconicedu/ui-web/lib/recurrence-types';
import {
  buildLearningSpaceSchedulesHashKeyFromPayload,
  normalizeScheduleFormDate,
  toScheduleDateOnlyIso,
} from '@iconicedu/web/lib/admin/learning-space-schedule-hash';

function addOneHour(time: string) {
  const [hourValue, minuteValue] = time.split(':').map((value) => Number(value));
  const hour = Number.isFinite(hourValue) ? hourValue : 9;
  const minute = Number.isFinite(minuteValue) ? minuteValue : 0;
  const nextHour = (hour + 1) % 24;
  return `${nextHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function cloneException(exception: RecurrenceException): RecurrenceException {
  return {
    id: exception.id,
    date: exception.date,
    reason: exception.reason ?? undefined,
  };
}

function cloneOverride(override: RecurrenceOverride): RecurrenceOverride {
  return {
    id: override.id,
    originalDate: override.originalDate,
    newDate: override.newDate,
    newTime: override.newTime ?? undefined,
    newEndTime: override.newEndTime ?? undefined,
    reason: override.reason ?? undefined,
  };
}

export function mapSchedulesToPayload(
  items: RecurrenceFormData[],
): NonNullable<LearningSpaceCreatePayload['schedules']> {
  return items.flatMap((schedule) => {
    const startDate = toScheduleDateOnlyIso(schedule.startDate, schedule.timezone);
    if (!startDate) {
      return [];
    }

    return [
      {
        startDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        timezone: schedule.timezone,
        rule: schedule.rule
          ? {
              ...schedule.rule,
              byWeekday: schedule.rule.byWeekday
                ? [...schedule.rule.byWeekday]
                : undefined,
              weekdayTimes: schedule.rule.weekdayTimes
                ? schedule.rule.weekdayTimes.map((entry) => ({
                    day: entry.day,
                    time: entry.time,
                  }))
                : undefined,
              byMonthDay: schedule.rule.byMonthDay
                ? [...schedule.rule.byMonthDay]
                : undefined,
              bySetPos: schedule.rule.bySetPos ? [...schedule.rule.bySetPos] : undefined,
              byMonth: schedule.rule.byMonth ? [...schedule.rule.byMonth] : undefined,
            }
          : null,
        exceptions: schedule.exceptions.map((exception) => ({
          date: exception.date,
          reason: exception.reason ?? undefined,
        })),
        overrides: schedule.overrides.map((override) => ({
          originalDate: override.originalDate,
          newDate: override.newDate,
          newTime: override.newTime ?? undefined,
          newEndTime: override.newEndTime ?? undefined,
          reason: override.reason ?? undefined,
        })),
      },
    ];
  });
}

export function buildSchedulesHashKeyFromFormSchedules(items: RecurrenceFormData[]) {
  return buildLearningSpaceSchedulesHashKeyFromPayload(mapSchedulesToPayload(items));
}

export function normalizeSchedules(items: RecurrenceFormData[]): RecurrenceFormData[] {
  return items.map((schedule) => ({
    ...schedule,
    startDate: normalizeScheduleFormDate(schedule.startDate, schedule.timezone),
    startTime: schedule.startTime ?? schedule.rule?.weekdayTimes?.[0]?.time ?? '09:00',
    endTime:
      schedule.endTime ??
      addOneHour(schedule.startTime ?? schedule.rule?.weekdayTimes?.[0]?.time ?? '09:00'),
    rule: schedule.rule
      ? {
          ...schedule.rule,
          byWeekday: schedule.rule.byWeekday ? [...schedule.rule.byWeekday] : undefined,
          weekdayTimes: schedule.rule.weekdayTimes
            ? schedule.rule.weekdayTimes.map((entry) => ({
                day: entry.day,
                time: entry.time,
              }))
            : undefined,
          byMonthDay: schedule.rule.byMonthDay
            ? [...schedule.rule.byMonthDay]
            : undefined,
          bySetPos: schedule.rule.bySetPos ? [...schedule.rule.bySetPos] : undefined,
          byMonth: schedule.rule.byMonth ? [...schedule.rule.byMonth] : undefined,
        }
      : undefined,
    exceptions: (schedule.exceptions ?? []).map(cloneException),
    overrides: (schedule.overrides ?? []).map(cloneOverride),
  }));
}
