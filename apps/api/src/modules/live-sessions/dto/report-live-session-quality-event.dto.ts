import { BadRequestException } from '@nestjs/common';

export type ReportLiveSessionQualityEventDto = {
  displayName: string;
  metric: 'network_quality' | 'connection_state';
  level: string;
  occurredAt: string;
};

const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_LEVEL_LENGTH = 40;
const METRICS = new Set(['network_quality', 'connection_state']);

export function parseReportLiveSessionQualityEventDto(
  input: unknown,
): ReportLiveSessionQualityEventDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;

  const displayName = body['displayName'];
  if (typeof displayName !== 'string' || !displayName.trim()) {
    throw new BadRequestException('displayName is required');
  }

  const metric = body['metric'];
  if (typeof metric !== 'string' || !METRICS.has(metric)) {
    throw new BadRequestException(
      "metric must be 'network_quality' or 'connection_state'",
    );
  }

  const level = body['level'];
  if (typeof level !== 'string' || !level.trim()) {
    throw new BadRequestException('level is required');
  }

  const occurredAt = body['occurredAt'];
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) {
    throw new BadRequestException('occurredAt must be a valid ISO date string');
  }

  return {
    displayName: displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
    metric: metric as 'network_quality' | 'connection_state',
    level: level.trim().slice(0, MAX_LEVEL_LENGTH),
    occurredAt,
  };
}
