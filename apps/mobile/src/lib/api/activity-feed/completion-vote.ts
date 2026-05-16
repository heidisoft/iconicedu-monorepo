import type { SubmitCompletionVoteInput } from '@iconicedu/shared-types';
import { apiPost } from '@/lib/api/http-client';

type CompletionVoteResponse = {
  feedbackEnabled: boolean;
};

export async function submitCompletionVote(
  input: SubmitCompletionVoteInput,
): Promise<CompletionVoteResponse> {
  return apiPost<CompletionVoteResponse>('/activity-feed/session-completion-vote', input);
}
