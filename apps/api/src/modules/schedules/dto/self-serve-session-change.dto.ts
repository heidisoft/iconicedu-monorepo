import { BadRequestException } from '@nestjs/common';

export type SelfServeCancelSessionDto = {
  orgId: string;
  scheduleId: string;
  occurrenceKey: string | null;
  note: string | null;
};

export type SelfServeRescheduleSessionDto = SelfServeCancelSessionDto & {
  startAt: string;
  endAt: string;
  timezone: string | null;
};

export type DecideSessionChangeRequestDto = {
  note: string | null;
};

function asBody(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  return input as Record<string, unknown>;
}

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

export function parseSelfServeCancelSessionDto(
  input: unknown,
): SelfServeCancelSessionDto {
  const body = asBody(input);
  return {
    orgId: requiredString(body, 'orgId'),
    scheduleId: requiredString(body, 'scheduleId'),
    occurrenceKey: optionalString(body, 'occurrenceKey'),
    note: optionalString(body, 'note'),
  };
}

export function parseSelfServeRescheduleSessionDto(
  input: unknown,
): SelfServeRescheduleSessionDto {
  const body = asBody(input);
  return {
    ...parseSelfServeCancelSessionDto(input),
    startAt: requiredString(body, 'startAt'),
    endAt: requiredString(body, 'endAt'),
    timezone: optionalString(body, 'timezone'),
  };
}

export function parseDecideSessionChangeRequestDto(
  input: unknown,
): DecideSessionChangeRequestDto {
  const body = asBody(input);
  return {
    note: optionalString(body, 'note'),
  };
}
