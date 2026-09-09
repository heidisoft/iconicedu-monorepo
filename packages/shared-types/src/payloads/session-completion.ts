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

// Reverts a just-confirmed or just-disputed row back to 'pending'. Only allowed
// server-side within a short window after resolution and before a rating exists —
// see UNDO_WINDOW_MS in session-completions.service.ts.
export type UndoSessionCompletionInput = {
  orgId: UUID;
  sessionCompletionId: UUID;
};

// The viewer confirmed the session but is intentionally NOT leaving a rating
// ("not voted"). Stamps `rated_at` with `rating` left null, so the completed-
// sessions carousel stops surfacing it and it does not come back on re-fetch.
// Only valid on a confirmed/auto_confirmed row that has no rating yet.
export type SkipSessionCompletionRatingInput = {
  orgId: UUID;
  sessionCompletionId: UUID;
};
