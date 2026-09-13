import { BadRequestException } from '@nestjs/common';

/** "This and following events" (Google-Calendar-style split): truncates the
 * existing recurring `class_schedules` series as of the edited occurrence and
 * creates a new series carrying the new day/time/weekday forward. See
 * SchedulesService.splitRecurringSeries. v1 only supports a single new weekday
 * (the recurrence being split must already be weekly/single-weekday too). */
export type SplitRecurringSessionDto = {
  orgId: string;
  scheduleId: string;
  /** The original (un-patched) occurrence key identifying which occurrence
   * becomes the split point — everything from its local calendar day onward
   * moves to the new series. */
  occurrenceKey: string;
  newStartAt: string;
  newEndAt: string;
  timezone: string | null;
  byWeekday: string[];
  reason: string | null;
  suppressNotifications: boolean;
  /** Set once the caller has confirmed dropping future exceptions/overrides
   * on the old pattern that the new series won't carry forward. */
  confirmDropFutureOverrides: boolean;
};

const RRULE_BYDAY_TOKENS = new Set(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);

function requiredString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${key} is required`);
  }
  return value.trim();
}

function optionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalBoolean(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === undefined) return false;
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${key} must be a boolean`);
  }
  return value;
}

function requiredWeekdayArray(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value) || value.length !== 1) {
    throw new BadRequestException(`${key} must be an array with exactly one weekday`);
  }
  return value.map((v, i) => {
    if (typeof v !== 'string')
      throw new BadRequestException(`${key}[${i}] must be a string`);
    if (!RRULE_BYDAY_TOKENS.has(v)) {
      throw new BadRequestException(
        `${key}[${i}] must be one of MO, TU, WE, TH, FR, SA, SU`,
      );
    }
    return v;
  });
}

export function parseSplitRecurringSessionDto(input: unknown): SplitRecurringSessionDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;

  return {
    orgId: requiredString(body, 'orgId'),
    scheduleId: requiredString(body, 'scheduleId'),
    occurrenceKey: requiredString(body, 'occurrenceKey'),
    newStartAt: requiredString(body, 'newStartAt'),
    newEndAt: requiredString(body, 'newEndAt'),
    timezone: optionalString(body, 'timezone'),
    byWeekday: requiredWeekdayArray(body, 'byWeekday'),
    reason: optionalString(body, 'reason'),
    suppressNotifications: optionalBoolean(body, 'suppressNotifications'),
    confirmDropFutureOverrides: optionalBoolean(body, 'confirmDropFutureOverrides'),
  };
}
