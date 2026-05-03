import { BadRequestException } from '@nestjs/common';

export type CancelSessionDto = {
  orgId: string;
  scheduleId: string;
  occurrenceKey: string | null;
  reason: string | null;
};

export function parseCancelSessionDto(input: unknown): CancelSessionDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;

  const orgId = body['orgId'];
  if (typeof orgId !== 'string' || !orgId.trim()) {
    throw new BadRequestException('orgId is required');
  }

  const scheduleId = body['scheduleId'];
  if (typeof scheduleId !== 'string' || !scheduleId.trim()) {
    throw new BadRequestException('scheduleId is required');
  }

  const occurrenceKey = body['occurrenceKey'];
  const reason = body['reason'];

  return {
    orgId: orgId.trim(),
    scheduleId: scheduleId.trim(),
    occurrenceKey:
      typeof occurrenceKey === 'string' && occurrenceKey.trim()
        ? occurrenceKey.trim()
        : null,
    reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
  };
}
