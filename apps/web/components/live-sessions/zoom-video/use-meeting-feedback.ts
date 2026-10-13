'use client';

import { useCallback, useRef, useState } from 'react';
import { clearLiveSessionRecovery } from '@iconicedu/web/lib/live-sessions/browser-session';
import { submitLiveSessionFeedback } from '@iconicedu/web/lib/live-sessions/public-api';

/** All terminal leave paths wait for feedback before navigating to the join source. */
export function useMeetingFeedback({
  liveSessionId,
  displayName,
  accessToken,
  onLeave,
}: {
  liveSessionId: string;
  displayName: string;
  accessToken?: string | null;
  onLeave?: () => void;
}) {
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const finished = useRef(false);
  const submitting = useRef(false);
  const beginFeedback = useCallback(
    (owner: Document = document) => {
      if (finished.current) return;
      clearLiveSessionRecovery(liveSessionId);
      if (owner.fullscreenElement) void owner.exitFullscreen().catch(() => {});
      setShowFeedbackPrompt(true);
    },
    [liveSessionId],
  );
  const finishLeaving = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    clearLiveSessionRecovery(liveSessionId);
    setShowFeedbackPrompt(false);
    // Remove the meeting portal immediately, even if router navigation is delayed.
    setHasLeft(true);
    onLeave?.();
  }, [liveSessionId, onLeave]);
  const submitFeedback = useCallback(async () => {
    if (finished.current || submitting.current) return;
    if (feedbackRating === null) {
      finishLeaving();
      return;
    }
    submitting.current = true;
    setIsFeedbackSubmitting(true);
    await submitLiveSessionFeedback(
      liveSessionId,
      {
        rating: feedbackRating,
        displayName,
      },
      accessToken,
    ).catch(() => null);
    submitting.current = false;
    setIsFeedbackSubmitting(false);
    finishLeaving();
  }, [feedbackRating, liveSessionId, displayName, accessToken, finishLeaving]);
  return {
    showFeedbackPrompt,
    hasLeft,
    feedbackRating,
    setFeedbackRating,
    isFeedbackSubmitting,
    beginFeedback,
    finishLeaving,
    submitFeedback,
  };
}
