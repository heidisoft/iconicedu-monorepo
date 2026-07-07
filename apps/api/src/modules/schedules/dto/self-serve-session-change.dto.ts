import { BadRequestException } from '@nestjs/common';

export type SelfServeCancelSessionDto = {
  orgId: string;
  scheduleId: string;
  occurrenceKey: string | null;
  note: string | null;
};

export type SelfServeUndoCancelSessionDto = Omit<SelfServeCancelSessionDto, 'note'>;

export type SelfServeRescheduleSessionDto = SelfServeCancelSessionDto & {
  startAt: string;
  endAt: string;
  timezone: string | null;
};

export type DecideSessionChangeRequestDto = {
  note: string | null;
};

export type UpsertSelfServePolicyDto = {
  orgId: string;
  learningSpaceId: string;
  enabled: boolean;
  cutoffHours: number;
  allowGuardian: boolean;
  allowEducator: boolean;
  allowChild: boolean;
  withinCutoffRequiresApproval: boolean;
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

function optionalBoolean(body: Record<string, unknown>, key: string, fallback: boolean) {
  const value = body[key];
  return typeof value === 'boolean' ? value : fallback;
}

function optionalNumber(body: Record<string, unknown>, key: string, fallback: number) {
  const value = body[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

export function parseSelfServeUndoCancelSessionDto(
  input: unknown,
): SelfServeUndoCancelSessionDto {
  const body = asBody(input);
  return {
    orgId: requiredString(body, 'orgId'),
    scheduleId: requiredString(body, 'scheduleId'),
    occurrenceKey: optionalString(body, 'occurrenceKey'),
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

export function parseUpsertSelfServePolicyDto(input: unknown): UpsertSelfServePolicyDto {
  const body = asBody(input);
  const cutoffHours = Math.round(optionalNumber(body, 'cutoffHours', 48));
  if (cutoffHours < 0 || cutoffHours > 720) {
    throw new BadRequestException('cutoffHours must be between 0 and 720');
  }

  return {
    orgId: requiredString(body, 'orgId'),
    learningSpaceId: requiredString(body, 'learningSpaceId'),
    enabled: optionalBoolean(body, 'enabled', true),
    cutoffHours,
    allowGuardian: optionalBoolean(body, 'allowGuardian', true),
    allowEducator: optionalBoolean(body, 'allowEducator', true),
    allowChild: optionalBoolean(body, 'allowChild', true),
    withinCutoffRequiresApproval: optionalBoolean(
      body,
      'withinCutoffRequiresApproval',
      true,
    ),
  };
}
