import { BadRequestException } from '@nestjs/common';

export type JoinLiveSessionDto = {
  orgId: string;
  profileId: string;
};

export function parseJoinLiveSessionDto(input: unknown): JoinLiveSessionDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;

  const orgId = body['orgId'];
  if (typeof orgId !== 'string' || !orgId.trim()) {
    throw new BadRequestException('orgId is required');
  }

  const profileId = body['profileId'];
  if (typeof profileId !== 'string' || !profileId.trim()) {
    throw new BadRequestException('profileId is required');
  }

  return {
    orgId: orgId.trim(),
    profileId: profileId.trim(),
  };
}
