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

// Natural-key addressed (not sessionCompletionId) because an admin acts on the
// whole occurrence at once — every participant row for it — rather than a
// single person's row, and the admin completed-sessions list only ever exposes
// the schedule/occurrence pair, not individual row ids. Confirming settles
// every still-open (pending/auto_confirmed) row for the occurrence, which is
// also what stops the confirm prompt from resurfacing for the teacher/parent.
export type AdminConfirmSessionCompletionInput = {
  orgId: UUID;
  scheduleId: UUID;
  occurrenceKey: string;
};

// Same natural-key addressing as AdminConfirmSessionCompletionInput, for removing a
// wrong/erroneous entry rather than resolving a real one. When profileId is omitted,
// every participant row for the occurrence is deleted (the whole occurrence was
// wrong); when present, only that one person's submission is deleted.
export type AdminDeleteSessionCompletionInput = {
  orgId: UUID;
  scheduleId: UUID;
  occurrenceKey: string;
  profileId?: UUID;
};

// Manually backfills a full 'pending' participant set (one row per
// educator/guardian/child on the schedule's own roster) for an occurrence that
// never got a completion-check trail at all — e.g. the dispatcher never ran for
// it. Every row starts 'pending', exactly like a normal live-dispatched
// session, so the real participants can confirm/dispute it themselves rather
// than the admin asserting an outcome on their behalf.
export type AdminCreateSessionCompletionInput = {
  orgId: UUID;
  scheduleId: UUID;
  occurrenceKey: string;
  sessionEndAt: string;
};
