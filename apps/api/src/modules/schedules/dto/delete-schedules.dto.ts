import { BadRequestException } from '@nestjs/common';

export type DeleteSchedulesDto = {
  orgId: string;
  learningSpaceId: string;
};

export function parseDeleteSchedulesDto(input: unknown): DeleteSchedulesDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;
  const orgId = body['orgId'];
  const learningSpaceId = body['learningSpaceId'];
  if (typeof orgId !== 'string' || !orgId.trim()) {
    throw new BadRequestException('orgId is required');
  }
  if (typeof learningSpaceId !== 'string' || !learningSpaceId.trim()) {
    throw new BadRequestException('learningSpaceId is required');
  }
  return { orgId: orgId.trim(), learningSpaceId: learningSpaceId.trim() };
}
