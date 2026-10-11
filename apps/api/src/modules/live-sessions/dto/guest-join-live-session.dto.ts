import { BadRequestException } from '@nestjs/common';
import type { LiveSessionJoinRequest } from '@iconicedu/shared-types';

export type GuestJoinLiveSessionDto = LiveSessionJoinRequest;

const MAX_DISPLAY_NAME_LENGTH = 80;

export function parseGuestJoinLiveSessionDto(input: unknown): GuestJoinLiveSessionDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;

  const displayName = body['displayName'];
  if (typeof displayName !== 'string' || !displayName.trim()) {
    throw new BadRequestException('displayName is required');
  }

  const passcode = body['passcode'];
  if (typeof passcode !== 'string' || !passcode.trim()) {
    throw new BadRequestException('passcode is required');
  }

  const studentProfileId = body['studentProfileId'];
  if (
    studentProfileId !== undefined &&
    (typeof studentProfileId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        studentProfileId,
      ))
  )
    throw new BadRequestException('Invalid student profile');

  return {
    ...(typeof studentProfileId === 'string' ? { studentProfileId } : {}),
    displayName: displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
    passcode: passcode.trim(),
  };
}
