import { BadRequestException } from '@nestjs/common';

export type LearningSpaceRemindersDto = {
  orgId: string;
  learningSpaceId: string;
};

function asRequiredString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${key} is required`);
  }
  return value.trim();
}

export function parseLearningSpaceRemindersDto(
  input: unknown,
): LearningSpaceRemindersDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }

  const body = input as Record<string, unknown>;
  return {
    orgId: asRequiredString(body, 'orgId'),
    learningSpaceId: asRequiredString(body, 'learningSpaceId'),
  };
}
