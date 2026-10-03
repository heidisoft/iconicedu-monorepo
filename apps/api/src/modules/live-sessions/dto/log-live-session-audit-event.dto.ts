import { BadRequestException } from '@nestjs/common';

export type LiveSessionAuditAction =
  | 'mute_participant'
  | 'end_session_for_all'
  | 'recording_started';

export type LogLiveSessionAuditEventDto = {
  action: LiveSessionAuditAction;
  targetDisplayName: string | null;
  occurredAt: string;
};

const MAX_DISPLAY_NAME_LENGTH = 80;
const ACTIONS = new Set<LiveSessionAuditAction>([
  'mute_participant',
  'end_session_for_all',
  'recording_started',
]);

export function parseLogLiveSessionAuditEventDto(
  input: unknown,
): LogLiveSessionAuditEventDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;

  const action = body['action'];
  if (typeof action !== 'string' || !ACTIONS.has(action as LiveSessionAuditAction)) {
    throw new BadRequestException(
      `action must be one of: ${Array.from(ACTIONS).join(', ')}`,
    );
  }

  const targetDisplayNameRaw = body['targetDisplayName'];
  const targetDisplayName =
    typeof targetDisplayNameRaw === 'string' && targetDisplayNameRaw.trim()
      ? targetDisplayNameRaw.trim().slice(0, MAX_DISPLAY_NAME_LENGTH)
      : null;

  const occurredAt = body['occurredAt'];
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) {
    throw new BadRequestException('occurredAt must be a valid ISO date string');
  }

  return {
    action: action as LiveSessionAuditAction,
    targetDisplayName,
    occurredAt,
  };
}
