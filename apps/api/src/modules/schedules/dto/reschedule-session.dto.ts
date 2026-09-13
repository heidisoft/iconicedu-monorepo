import { BadRequestException } from '@nestjs/common';

/** `'occurrence'` (default) is today's per-occurrence override behavior. `'all'`
 * rewrites the recurrence rule in place for the whole series — only meaningful
 * together with `byWeekday`. See SchedulesService.rescheduleScheduleSession. */
export type RescheduleSessionScope = 'occurrence' | 'all';

export type RescheduleSessionDto = {
  orgId: string;
  scheduleId: string;
  occurrenceKey: string | null;
  startAt: string;
  endAt: string;
  timezone: string | null;
  reason: string | null;
  suppressNotifications: boolean;
  scope: RescheduleSessionScope;
  /** `scope: 'all'` only — the new single weekday for the series (v1 supports
   * exactly one; the recurrence must already be weekly/single-weekday). */
  byWeekday: string[] | null;
  /** `scope: 'all'` only — set once the caller has confirmed dropping any
   * future exceptions/overrides that no longer apply after a weekday change. */
  confirmDropFutureOverrides: boolean;
};

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
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${key} must be a boolean`);
  }
  return value;
}

function parseScope(body: Record<string, unknown>): RescheduleSessionScope {
  const value = body['scope'];
  if (value === undefined || value === null || value === 'occurrence')
    return 'occurrence';
  if (value === 'all') return 'all';
  throw new BadRequestException("scope must be 'occurrence' or 'all'");
}

const RRULE_BYDAY_TOKENS = new Set(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);

function optionalWeekdayArray(
  body: Record<string, unknown>,
  key: string,
): string[] | null {
  const value = body[key];
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException(`${key} must be a non-empty array`);
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

export function parseRescheduleSessionDto(input: unknown): RescheduleSessionDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;
  const scope = parseScope(body);
  const byWeekday = optionalWeekdayArray(body, 'byWeekday');

  if (scope === 'all' && (!byWeekday || byWeekday.length !== 1)) {
    throw new BadRequestException("scope 'all' requires exactly one byWeekday entry");
  }

  return {
    orgId: requiredString(body, 'orgId'),
    scheduleId: requiredString(body, 'scheduleId'),
    occurrenceKey: optionalString(body, 'occurrenceKey'),
    startAt: requiredString(body, 'startAt'),
    endAt: requiredString(body, 'endAt'),
    timezone: optionalString(body, 'timezone'),
    reason: optionalString(body, 'reason'),
    suppressNotifications: optionalBoolean(body, 'suppressNotifications'),
    scope,
    byWeekday,
    confirmDropFutureOverrides: optionalBoolean(body, 'confirmDropFutureOverrides'),
  };
}
