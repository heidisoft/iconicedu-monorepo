import { BadRequestException } from '@nestjs/common';

type OrgRef = {
  /** Web addresses the org by slug; mobile by id. Exactly one is required. */
  orgSlug: string | null;
  orgId: string | null;
};

export type JoinClassSessionOccurrenceDto = OrgRef & {
  scheduleId: string;
  occurrenceKey: string;
  /**
   * Profile the join is attributed to when a guardian is browsing as a linked
   * child. Validated against the caller's account in `resolveLiveSessionActor` —
   * never trusted as sent.
   */
  actingProfileId: string | null;
};

function requireTrimmedString(
  body: Record<string, unknown>,
  key: string,
  label = key,
): string {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${label} is required`);
  }
  return value.trim();
}

function requireIsoDateTime(value: string, label: string): string {
  if (!Number.isFinite(new Date(value).getTime())) {
    throw new BadRequestException(`${label} must be an ISO date-time`);
  }
  return value;
}

function readOptionalString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${key} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireOrgRef(body: Record<string, unknown>): OrgRef {
  const orgSlug = readOptionalString(body, 'orgSlug');
  const orgId = readOptionalString(body, 'orgId');

  if (!orgSlug && !orgId) {
    throw new BadRequestException('orgSlug or orgId is required');
  }

  return { orgSlug, orgId };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  return input as Record<string, unknown>;
}

export function parseJoinClassSessionOccurrenceDto(
  input: unknown,
): JoinClassSessionOccurrenceDto {
  const body = asRecord(input);

  return {
    ...requireOrgRef(body),
    scheduleId: requireTrimmedString(body, 'scheduleId'),
    occurrenceKey: requireIsoDateTime(
      requireTrimmedString(body, 'occurrenceKey'),
      'occurrenceKey',
    ),
    actingProfileId: readOptionalString(body, 'actingProfileId'),
  };
}

export type ClassSessionJoinAvailabilityDto = JoinClassSessionOccurrenceDto;

export function parseClassSessionJoinAvailabilityDto(
  input: unknown,
): ClassSessionJoinAvailabilityDto {
  return parseJoinClassSessionOccurrenceDto(input);
}

export type JoinChannelLiveSessionDto = OrgRef & {
  actingProfileId: string | null;
};

export function parseJoinChannelLiveSessionDto(
  input: unknown,
): JoinChannelLiveSessionDto {
  const body = asRecord(input);

  return {
    ...requireOrgRef(body),
    actingProfileId: readOptionalString(body, 'actingProfileId'),
  };
}

export type ClassSessionJoinAvailabilityRangeDto = OrgRef & {
  fromAt: string;
  toAt: string;
  actingProfileId: string | null;
};

export function parseClassSessionJoinAvailabilityRangeDto(
  input: unknown,
): ClassSessionJoinAvailabilityRangeDto {
  const body = asRecord(input);
  const fromAt = requireIsoDateTime(requireTrimmedString(body, 'fromAt'), 'fromAt');
  const toAt = requireIsoDateTime(requireTrimmedString(body, 'toAt'), 'toAt');

  if (new Date(toAt).getTime() < new Date(fromAt).getTime()) {
    throw new BadRequestException('toAt must not precede fromAt');
  }

  return {
    ...requireOrgRef(body),
    fromAt,
    toAt,
    actingProfileId: readOptionalString(body, 'actingProfileId'),
  };
}
