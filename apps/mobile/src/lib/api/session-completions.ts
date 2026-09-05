import type {
  ConfirmSessionCompletionInput,
  ConnectionVM,
  DisputeSessionCompletionInput,
  RateSessionCompletionInput,
  SessionCompletionVM,
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

export function confirmSessionCompletion(input: ConfirmSessionCompletionInput) {
  return apiPost<{ success: true; feedbackEnabled: true }>(
    `/session-completions/${input.sessionCompletionId}/confirm`,
    { orgId: input.orgId },
  );
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
