import { useEffect, useState } from 'react';
import type { AiAssistEligibilityResult } from '@iconicedu/shared-types';
import { fetchAiAssistEligibility } from '@/lib/api/messages/queries';

const DISABLED: AiAssistEligibilityResult = {
  enableAiRefine: false,
  enableAiSuggestedReplies: false,
};

/**
 * Server-computed truth for whether the AI-assist composer affordances
 * (refine, suggested replies) should show — see
 * `AiAssistService.getEligibility` on the API. Mobile's PostHog client
 * identifies sessions by auth user id (see auth-provider.tsx), which can
 * diverge from the profile id the API actually gates these flags on;
 * evaluating the flags client-side against that different identity can
 * show/hide the composer inconsistently with what the API will allow
 * (PR #269 review). Asking the server directly keeps the two in sync.
 */
export function useAiAssistEligibility(input: {
  orgId?: string | null;
  profileId?: string | null;
}): AiAssistEligibilityResult {
  const { orgId, profileId } = input;
  const [eligibility, setEligibility] = useState<AiAssistEligibilityResult>(DISABLED);

  useEffect(() => {
    if (!orgId || !profileId) {
      setEligibility(DISABLED);
      return;
    }

    let cancelled = false;
    fetchAiAssistEligibility({ orgId, profileId })
      .then((result) => {
        if (!cancelled) setEligibility(result);
      })
      .catch(() => {
        if (!cancelled) setEligibility(DISABLED);
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, profileId]);

  return eligibility;
}
