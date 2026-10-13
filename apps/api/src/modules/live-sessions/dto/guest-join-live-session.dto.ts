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
  // Empty passcodes are accepted structurally for hosts; the service verifies host
  // authorization before deciding whether a correct passcode is required.
  if (typeof passcode !== 'string') {
    throw new BadRequestException('passcode is required');
  }

  const admissionToken = body['admissionToken'];
  if (
    admissionToken !== undefined &&
    (typeof admissionToken !== 'string' || !/^[\w-]{32}$/.test(admissionToken))
  )
    throw new BadRequestException('Invalid admission token');
  const linkToken = body['linkToken'];
  if (
    linkToken !== undefined &&
    (typeof linkToken !== 'string' || !/^[\w-]{32}$/.test(linkToken))
  )
    throw new BadRequestException('Invalid meeting link');
  const override = body['displayNameOverride'];
  if (
    override !== undefined &&
    (typeof override !== 'string' ||
      !override.trim() ||
      override.trim().length > MAX_DISPLAY_NAME_LENGTH)
  )
    throw new BadRequestException('Display name must be between 1 and 80 characters');

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
    ...(typeof admissionToken === 'string' ? { admissionToken } : {}),
    ...(typeof linkToken === 'string' ? { linkToken } : {}),
    ...(typeof override === 'string' ? { displayNameOverride: override.trim() } : {}),
    ...(typeof studentProfileId === 'string' ? { studentProfileId } : {}),
    displayName: displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
    passcode: passcode.trim(),
  };
}
