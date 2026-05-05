import { BadRequestException } from '@nestjs/common';

export type RescheduleSessionDto = {
  orgId: string;
  scheduleId: string;
  occurrenceKey: string | null;
  startAt: string;
  endAt: string;
  timezone: string | null;
  reason: string | null;
  suppressNotifications: boolean;
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

export function parseRescheduleSessionDto(input: unknown): RescheduleSessionDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;

  return {
    orgId: requiredString(body, 'orgId'),
    scheduleId: requiredString(body, 'scheduleId'),
    occurrenceKey: optionalString(body, 'occurrenceKey'),
    startAt: requiredString(body, 'startAt'),
    endAt: requiredString(body, 'endAt'),
    timezone: optionalString(body, 'timezone'),
    reason: optionalString(body, 'reason'),
    suppressNotifications: optionalBoolean(body, 'suppressNotifications'),
  };
}
