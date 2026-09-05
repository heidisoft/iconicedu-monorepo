import type { UUID } from '@iconicedu/shared-types/shared/shared';
import type { ClassSessionCompletionDisputeCategory } from '@iconicedu/shared-types/rows/class-session-completion';

// All three payloads are id-addressed (sessionCompletionId), not natural-key-addressed
// (schedule + occurrence + role) like the old SubmitCompletionVoteInput/
// SubmitSessionFeedbackInput — the row already exists by the time a client can act on
// it (only the dispatcher creates rows), so referencing it directly removes a whole
// class of occurrence-key/timezone client-side reconstruction bugs.

export type ConfirmSessionCompletionInput = {
  orgId: UUID;
  sessionCompletionId: UUID;
};

export type DisputeSessionCompletionInput = {
  orgId: UUID;
  sessionCompletionId: UUID;
  disputeCategory: ClassSessionCompletionDisputeCategory;
  disputeReason?: string | null;
  rescheduleRequested?: boolean;
};

export type RateSessionCompletionInput = {
  orgId: UUID;
  sessionCompletionId: UUID;
  rating: number;
  comment?: string | null;
};
