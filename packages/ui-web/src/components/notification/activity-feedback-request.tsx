'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  formatScheduleDisplayTimeWithZone,
  resolveScheduleDisplayTimeZone,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';

const EDIT_WINDOW_MS = 60_000;
// Lets the just-picked stars stay visible (filled, disabled) for a beat before the
// "Thank you" confirmation replaces them — without this, submitting looked like the
// stars just vanished, since the confirmation appeared the instant the API resolved.
const CONFIRMATION_REVEAL_DELAY_MS = 500;

type ActivityFeedbackRequestProps = {
  activity: ActivityFeedLeafItemVM;
  onRatingSubmit?: () => void;
  /** See ActivityCompletionCheck's `embedded` prop — same idea, same reason. */
  embedded?: boolean;
};

type FeedbackMetadata = {
  sessionCompletionId: string | null;
  feedbackUiEnabled: boolean;
};

type FeedbackState = {
  rating: number;
  comment: string;
  submittedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getFeedbackMetadata(activity: ActivityFeedLeafItemVM): FeedbackMetadata {
  const metadata = asRecord(activity.metadata);
  const sessionCompletion = asRecord(metadata.sessionCompletion);
  return {
    sessionCompletionId:
      typeof sessionCompletion.id === 'string'
        ? sessionCompletion.id
        : typeof metadata.sessionCompletionId === 'string'
          ? metadata.sessionCompletionId
          : null,
    feedbackUiEnabled: metadata.feedbackUiEnabled !== false,
  };
}

function getInitialFeedback(activity: ActivityFeedLeafItemVM): FeedbackState {
  const metadata = asRecord(activity.metadata);
  const feedback = asRecord(metadata.sessionCompletion);

  return {
    rating: typeof feedback.rating === 'number' ? feedback.rating : 0,
    comment: typeof feedback.ratingComment === 'string' ? feedback.ratingComment : '',
    submittedAt: typeof feedback.ratedAt === 'string' ? feedback.ratedAt : null,
  };
}

function resolveEditWindowOpen(submittedAt: string | null) {
  if (!submittedAt) {
    return false;
  }

  const submittedTimestamp = new Date(submittedAt).getTime();
  if (Number.isNaN(submittedTimestamp)) {
    return false;
  }

  return submittedTimestamp + EDIT_WINDOW_MS > Date.now();
}

function formatSubmittedAtTooltip(submittedAt: string | null) {
  if (!submittedAt) {
    return null;
  }

  const submittedDate = new Date(submittedAt);
  if (Number.isNaN(submittedDate.getTime())) {
    return null;
  }

  const userTimeZone = resolveScheduleDisplayTimeZone();
  const formatted = formatScheduleDisplayTimeWithZone(submittedDate, userTimeZone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!formatted) {
    return null;
  }

  return `Submitted ${formatted}`;
}

export function canRenderActivityFeedbackRequest(activity: ActivityFeedLeafItemVM) {
  const metadata = getFeedbackMetadata(activity);
  return metadata.feedbackUiEnabled && Boolean(metadata.sessionCompletionId);
}

export function ActivityFeedbackRequest({
  activity,
  onRatingSubmit,
  embedded = false,
}: ActivityFeedbackRequestProps) {
  const initialFeedback = useMemo(() => getInitialFeedback(activity), [activity]);
  const metadata = useMemo(() => getFeedbackMetadata(activity), [activity]);

  const [rating, setRating] = useState(initialFeedback.rating);
  const [comment, setComment] = useState(initialFeedback.comment);
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    initialFeedback.submittedAt,
  );
  const [hoveredRating, setHoveredRating] = useState(0);
  const [showComment, setShowComment] = useState(
    initialFeedback.rating > 0 &&
      initialFeedback.rating < 5 &&
      !initialFeedback.submittedAt,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditWindowOpen, setIsEditWindowOpen] = useState(() =>
    resolveEditWindowOpen(initialFeedback.submittedAt),
  );
  // True immediately when resuming an already-submitted rating (no artificial delay
  // on page load) — only set with a delay for a fresh, in-session submit.
  const [showConfirmation, setShowConfirmation] = useState(() =>
    Boolean(initialFeedback.submittedAt),
  );
  const confirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRating(initialFeedback.rating);
    setComment(initialFeedback.comment);
    setSubmittedAt(initialFeedback.submittedAt);
    setHoveredRating(0);
    setShowComment(
      initialFeedback.rating > 0 &&
        initialFeedback.rating < 5 &&
        !initialFeedback.submittedAt,
    );
    setError(null);
    setIsEditing(false);
    setIsEditWindowOpen(resolveEditWindowOpen(initialFeedback.submittedAt));
    setShowConfirmation(Boolean(initialFeedback.submittedAt));
  }, [initialFeedback]);

  useEffect(() => {
    return () => {
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!submittedAt) {
      setIsEditWindowOpen(false);
      return;
    }

    const submittedTimestamp = new Date(submittedAt).getTime();
    if (Number.isNaN(submittedTimestamp)) {
      setIsEditWindowOpen(false);
      return;
    }

    const remainingMs = submittedTimestamp + EDIT_WINDOW_MS - Date.now();
    if (remainingMs <= 0) {
      setIsEditWindowOpen(false);
      return;
    }

    setIsEditWindowOpen(true);
    const timer = window.setTimeout(() => {
      setIsEditWindowOpen(false);
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [submittedAt]);

  const canSubmit = metadata.feedbackUiEnabled && Boolean(metadata.sessionCompletionId);
  const isSubmitted = Boolean(submittedAt) && !isEditing;
  const displayRating = hoveredRating || rating;
  const trimmedComment = comment.trim();
  const submittedTooltip = formatSubmittedAtTooltip(submittedAt);

  const submitFeedback = async (nextRating: number, nextComment?: string) => {
    if (!canSubmit || nextRating < 1 || nextRating > 5) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/session-completions/${metadata.sessionCompletionId}/rate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            orgId: activity.ids.orgId,
            rating: nextRating,
            comment: nextComment ?? null,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Unable to submit feedback');
        return;
      }

      const nextSubmittedAt = new Date().toISOString();
      const nextResolvedComment = nextComment ?? '';
      setRating(nextRating);
      setComment(nextResolvedComment);
      setSubmittedAt(nextSubmittedAt);
      setShowComment(false);
      setHoveredRating(0);
      setIsEditing(false);
      setIsEditWindowOpen(true);
      setShowConfirmation(false);
      if (confirmationTimeoutRef.current) {
        clearTimeout(confirmationTimeoutRef.current);
      }
      confirmationTimeoutRef.current = setTimeout(() => {
        confirmationTimeoutRef.current = null;
        setShowConfirmation(true);
      }, CONFIRMATION_REVEAL_DELAY_MS);
      onRatingSubmit?.();
    } catch {
      setError('Unable to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectRating = async (value: number) => {
    if (isSubmitting || isSubmitted) {
      return;
    }

    setError(null);
    setRating(value);

    if (value === 5) {
      await submitFeedback(value);
      return;
    }

    setShowComment(true);
  };

  const handleSubmit = async () => {
    if (isSubmitting || rating < 1) {
      return;
    }

    await submitFeedback(rating, trimmedComment);
  };

  const handleResetRating = () => {
    setIsEditing(true);
    setHoveredRating(0);
    setShowComment(rating > 0 && rating < 5);
    setError(null);
  };

  if (!metadata.feedbackUiEnabled) {
    return null;
  }

  return (
    <div
      className={cn(
        'w-full text-xs',
        embedded
          ? undefined
          : 'rounded-xl border border-border/80 bg-background/95 p-4 md:max-w-[420px]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Rate your session
        </p>
        {isSubmitted && isEditWindowOpen && showConfirmation ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleResetRating}
            data-action-button="true"
            className="text-xs"
          >
            Edit rating
          </Button>
        ) : null}
      </div>

      <div
        className="mt-2 flex items-center gap-2"
        role="group"
        aria-label="Session feedback rating"
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const value = index + 1;
          const isActive = value <= displayRating;
          return (
            <button
              key={value}
              type="button"
              onClick={() => void handleSelectRating(value)}
              onMouseEnter={() => setHoveredRating(value)}
              onMouseLeave={() => setHoveredRating(0)}
              onFocus={() => setHoveredRating(value)}
              onBlur={() => setHoveredRating(0)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background transition-colors duration-150',
                canSubmit && !isSubmitting && !isSubmitted
                  ? 'cursor-pointer hover:border-warning/40 hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2'
                  : 'cursor-default',
              )}
              aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
              aria-pressed={rating === value}
              disabled={!canSubmit || isSubmitting || isSubmitted}
            >
              <Star
                className={cn(
                  'h-4 w-4 transition-colors duration-150',
                  isActive ? 'fill-warning text-warning' : 'text-muted-foreground',
                )}
              />
            </button>
          );
        })}
      </div>

      {!isSubmitted && showComment ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            placeholder="Tell us what could be better..."
            className="min-h-[112px] text-xs placeholder:text-xs"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            data-action-button="true"
            className="w-full text-xs"
          >
            Submit feedback
          </Button>
        </div>
      ) : null}

      {isSubmitted && showConfirmation ? (
        <div
          className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
          title={submittedTooltip ?? undefined}
        >
          <p className="font-semibold text-foreground">Thank you for your feedback.</p>
        </div>
      ) : null}

      {!isSubmitted && !showComment && rating > 0 && rating < 5 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Add a comment to submit a rating below 5 stars.
        </p>
      ) : null}

      {!isSubmitted && !canSubmit ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Feedback is unavailable for this session.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
