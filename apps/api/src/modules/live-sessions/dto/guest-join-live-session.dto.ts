import { BadRequestException } from '@nestjs/common';

export type GuestJoinLiveSessionDto = {
  displayName: string;
  passcode: string;
};

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

  return {
    displayName: displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
    passcode: passcode.trim(),
  };
}
