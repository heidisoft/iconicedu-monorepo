import type { LearningSpaceCreatePayload } from '@iconicedu/shared-types';
import type {
  RecurrenceException,
  RecurrenceFormData,
  RecurrenceOverride,
} from '@iconicedu/ui-web/lib/recurrence-types';

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
    reason: override.reason ?? undefined,
  };
}

export function mapSchedulesToPayload(
  items: RecurrenceFormData[],
): NonNullable<LearningSpaceCreatePayload['schedules']> {
  return items
    .filter((schedule) => schedule.startDate)
    .map((schedule) => ({
      startDate:
        schedule.startDate instanceof Date
          ? schedule.startDate.toISOString()
          : new Date(schedule.startDate as unknown as string).toISOString(),
      timezone: schedule.timezone,
      rule: {
        ...schedule.rule,
        byWeekday: schedule.rule.byWeekday ? [...schedule.rule.byWeekday] : undefined,
        weekdayTimes: schedule.rule.weekdayTimes
          ? schedule.rule.weekdayTimes.map((entry) => ({
              day: entry.day,
              time: entry.time,
            }))
          : undefined,
      },
      exceptions: schedule.exceptions.map((exception) => ({
        date: exception.date,
        reason: exception.reason ?? undefined,
      })),
      overrides: schedule.overrides.map((override) => ({
        originalDate: override.originalDate,
        newDate: override.newDate,
        newTime: override.newTime ?? undefined,
        reason: override.reason ?? undefined,
      })),
    }));
}

export function normalizeSchedules(items: RecurrenceFormData[]): RecurrenceFormData[] {
  return items.map((schedule) => ({
    ...schedule,
    startDate:
      schedule.startDate instanceof Date
        ? new Date(schedule.startDate.getTime())
        : schedule.startDate
          ? new Date(schedule.startDate as unknown as string)
          : undefined,
    rule: {
      ...schedule.rule,
      byWeekday: schedule.rule.byWeekday ? [...schedule.rule.byWeekday] : undefined,
      weekdayTimes: schedule.rule.weekdayTimes
        ? schedule.rule.weekdayTimes.map((entry) => ({
            day: entry.day,
            time: entry.time,
          }))
        : undefined,
    },
    exceptions: (schedule.exceptions ?? []).map(cloneException),
    overrides: (schedule.overrides ?? []).map(cloneOverride),
  }));
}
