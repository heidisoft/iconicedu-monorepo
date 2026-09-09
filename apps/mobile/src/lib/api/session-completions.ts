import type {
  ConfirmSessionCompletionInput,
  ConnectionVM,
  DisputeSessionCompletionInput,
  RateSessionCompletionInput,
  SessionCompletionVM,
  SkipSessionCompletionRatingInput,
  UndoSessionCompletionInput,
} from '@iconicedu/shared-types';
import { apiGet, apiPost } from '@/lib/api/http-client';

export function listSessionCompletions(input: {
  orgId: string;
  profileId: string;
  cursor?: string | null;
  limit?: number;
}) {
  return apiGet<ConnectionVM<SessionCompletionVM>>('/session-completions', input);
}

export function getOrgSessionCompletionSummary(input: {
  orgId: string;
  completedSince?: string;
  completedUntil?: string;
}) {
  return apiGet<{ completed: number; pending: number }>(
    '/session-completions/org-summary',
    input,
  );
}

export function confirmSessionCompletion(input: ConfirmSessionCompletionInput) {
  return apiPost<{
    success: true;
    feedbackEnabled: boolean;
    // Present when the session was already complete (auto-confirmed by the
    // system, or confirmed from another device) — the call is a no-op success.
    alreadyResolved?: boolean;
    status?: 'confirmed' | 'auto_confirmed';
  }>(`/session-completions/${input.sessionCompletionId}/confirm`, {
    orgId: input.orgId,
  });
}

export function disputeSessionCompletion(input: DisputeSessionCompletionInput) {
  return apiPost<{ success: true; feedbackEnabled: false }>(
    `/session-completions/${input.sessionCompletionId}/dispute`,
    {
      orgId: input.orgId,
      disputeCategory: input.disputeCategory,
      disputeReason: input.disputeReason ?? null,
      rescheduleRequested: input.rescheduleRequested ?? false,
    },
  );
}

export function rateSessionCompletion(input: RateSessionCompletionInput) {
  return apiPost<{ success: true }>(
    `/session-completions/${input.sessionCompletionId}/rate`,
    {
      orgId: input.orgId,
      rating: input.rating,
      comment: input.comment ?? null,
    },
  );
}

export function undoSessionCompletion(input: UndoSessionCompletionInput) {
  return apiPost<{ success: true }>(
    `/session-completions/${input.sessionCompletionId}/undo`,
    {
      orgId: input.orgId,
    },
  );
}

// Viewer confirmed the session but closed the rating prompt without scoring it.
export function skipSessionCompletionRating(input: SkipSessionCompletionRatingInput) {
  return apiPost<{ success: true; alreadyResolved?: boolean }>(
    `/session-completions/${input.sessionCompletionId}/skip-rating`,
    {
      orgId: input.orgId,
    },
  );
}
