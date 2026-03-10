import type { UUID } from '@iconicedu/shared-types/shared/shared';

export type SubmitSessionFeedbackInput = {
  orgId: UUID;
  classSessionId: UUID;
  classroomId: UUID;
  channelId: UUID;
  rating: number;
  comment?: string | null;
  messageId?: UUID | null;
  sourceEventId?: UUID | null;
  occurrenceStartAt?: string | null;
};
