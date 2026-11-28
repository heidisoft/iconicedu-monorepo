import type {
  AdminSessionCompletionVM,
  ConfirmSessionCompletionInput,
  ConnectionVM,
  DisputeSessionCompletionInput,
  RateSessionCompletionInput,
  ReportSessionCompletionInput,
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

// Full history for the "Sessions completed" screen — not the carousel window
// listSessionCompletions returns. `status` picks a tab: confirmed/auto_confirmed
// rows, or rows still awaiting the viewer's confirmation.
export function listSessionCompletionHistory(input: {
  orgId: string;
  profileId: string;
  status: 'completed' | 'pending';
  completedSince?: string;
  completedUntil?: string;
  cursor?: string | null;
  limit?: number;
}) {
  return apiGet<ConnectionVM<SessionCompletionVM>>('/session-completions/history', input);
}

// Org-wide occurrence list for staff/admins (same endpoint as web's admin
// attendance page). The API clamps it to a rolling three-month window.
export function listAdminSessionCompletions(input: {
  orgId: string;
  completedSince?: string;
  completedUntil?: string;
}) {
  return apiGet<AdminSessionCompletionVM[]>('/session-completions/admin', input);
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

export function getSessionCompletionSummary(input: {
  orgId: string;
  profileId: string;
  completedSince?: string;
  completedUntil?: string;
}) {
  return apiGet<{ completed: number; pending: number }>(
    '/session-completions/summary',
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

// Flags a session that was marked complete without the viewer (auto-confirmed or
// staff-confirmed) for staff review. The session's status does not change.
export function reportSessionCompletion(input: ReportSessionCompletionInput) {
  return apiPost<{ success: true }>(
    `/session-completions/${input.sessionCompletionId}/report`,
    {
      orgId: input.orgId,
      reportCategory: input.reportCategory,
      reportReason: input.reportReason ?? null,
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
