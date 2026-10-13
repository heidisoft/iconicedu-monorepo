import { BadRequestException } from '@nestjs/common';

export type SubmitLiveSessionFeedbackDto = {
  rating: number;
  displayName: string;
};

const MAX_DISPLAY_NAME_LENGTH = 80;

export function parseSubmitLiveSessionFeedbackDto(
  input: unknown,
): SubmitLiveSessionFeedbackDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;

  const rating = body['rating'];
  if (
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    throw new BadRequestException('rating must be an integer between 1 and 5');
  }

  const displayName = body['displayName'];
  if (typeof displayName !== 'string' || !displayName.trim()) {
    throw new BadRequestException('displayName is required');
  }

  return {
    rating,
    displayName: displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
  };
}
