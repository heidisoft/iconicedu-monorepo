import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

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

export type SubmitCompletionVoteInput = {
  orgId: UUID;
  scheduleId: UUID;
  occurrenceKey: ISODateTime;
  role: string;
  status: 'confirmed' | 'disputed';
  recipientProfileId?: UUID | null;
  disputeCategory?: string | null;
  disputeReason?: string | null;
  rescheduleRequested?: boolean;
};
