'use client';

import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';

const EDIT_WINDOW_MS = 60_000;

type ActivityFeedbackRequestProps = {
  activity: ActivityFeedLeafItemVM;
};

type FeedbackMetadata = {
  sourceEventId: string | null;
  messageId: string | null;
  classSessionId: string | null;
  classroomId: string | null;
  channelId: string | null;
  occurrenceStart: string | null;
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
  return {
    sourceEventId:
      typeof metadata.sourceEventId === 'string' ? metadata.sourceEventId : null,
    messageId: typeof metadata.messageId === 'string' ? metadata.messageId : null,
    classSessionId:
      typeof metadata.classSessionId === 'string' ? metadata.classSessionId : null,
    classroomId: typeof metadata.classroomId === 'string' ? metadata.classroomId : null,
    channelId: typeof metadata.channelId === 'string' ? metadata.channelId : null,
    occurrenceStart:
      typeof metadata.occurrenceStart === 'string' ? metadata.occurrenceStart : null,
    feedbackUiEnabled: metadata.feedbackUiEnabled !== false,
  };
}

function getInitialFeedback(activity: ActivityFeedLeafItemVM): FeedbackState {
  const metadata = asRecord(activity.metadata);
  const feedback = asRecord(metadata.feedbackResponse);

  return {
    rating: typeof feedback.rating === 'number' ? feedback.rating : 0,
    comment: typeof feedback.comment === 'string' ? feedback.comment : '',
    submittedAt: typeof feedback.submittedAt === 'string' ? feedback.submittedAt : null,
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

export function canRenderActivityFeedbackRequest(activity: ActivityFeedLeafItemVM) {
  return getFeedbackMetadata(activity).feedbackUiEnabled;
}

export function ActivityFeedbackRequest({ activity }: ActivityFeedbackRequestProps) {
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
  }, [initialFeedback]);

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

  const hasSource = Boolean(metadata.sourceEventId);
  const hasMessage = Boolean(metadata.messageId);
  const canSubmit =
    metadata.feedbackUiEnabled &&
    (hasSource || hasMessage) &&
    Boolean(metadata.classSessionId) &&
    Boolean(metadata.classroomId) &&
    Boolean(metadata.channelId);
  const isSubmitted = Boolean(submittedAt) && !isEditing;
  const displayRating = hoveredRating || rating;
  const requiresComment = rating > 0 && rating < 5;
  const trimmedComment = comment.trim();
  const canSubmitComment = !requiresComment || trimmedComment.length > 0;

  const submitFeedback = async (nextRating: number, nextComment?: string) => {
    if (!canSubmit || nextRating < 1 || nextRating > 5) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/activity-feed/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orgId: activity.ids.orgId,
          classSessionId: metadata.classSessionId,
          classroomId: metadata.classroomId,
          channelId: metadata.channelId,
          sourceEventId: hasSource ? metadata.sourceEventId : null,
          messageId: hasMessage ? metadata.messageId : null,
          occurrenceStartAt: metadata.occurrenceStart,
          rating: nextRating,
          comment: nextComment ?? null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        data?: {
          submittedAt?: string | null;
          rating?: number;
          comment?: string | null;
        };
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Unable to submit feedback');
        return;
      }

      const nextSubmittedAt = payload?.data?.submittedAt ?? new Date().toISOString();
      const nextResolvedComment = payload?.data?.comment ?? nextComment ?? '';
      setRating(nextRating);
      setComment(nextResolvedComment);
      setSubmittedAt(nextSubmittedAt);
      setShowComment(false);
      setHoveredRating(0);
      setIsEditing(false);
      setIsEditWindowOpen(true);
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

    if (!canSubmitComment) {
      setError('Add a comment for ratings below 5 stars.');
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
    <div className="rounded-xl border border-border/80 bg-background/95 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Rate this session
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSubmitted
              ? 'Your feedback was saved.'
              : 'Choose a rating to share how the class went.'}
          </p>
        </div>

        {isSubmitted && isEditWindowOpen ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleResetRating}
            data-action-button="true"
          >
            Edit rating
          </Button>
        ) : null}
      </div>

      <div
        className="mt-4 flex items-center gap-2"
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
                'flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors duration-150',
                canSubmit && !isSubmitting && !isSubmitted
                  ? 'cursor-pointer hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2'
                  : 'cursor-default',
              )}
              aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
              aria-pressed={rating === value}
              disabled={!canSubmit || isSubmitting || isSubmitted}
            >
              <Star
                className={cn(
                  'h-5 w-5 transition-colors duration-150',
                  isActive ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
                )}
              />
            </button>
          );
        })}
      </div>

      {!isSubmitted && showComment ? (
        <div className="mt-4 space-y-3">
          <Textarea
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            placeholder="Tell us what could be better..."
            className="min-h-[112px]"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Ratings below 5 stars require a comment.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || !canSubmitComment}
              data-action-button="true"
            >
              Submit feedback
            </Button>
          </div>
        </div>
      ) : null}

      {isSubmitted ? (
        <div className="mt-4 rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Thank you for your feedback.</p>
          <p className="mt-1">
            You rated this session {rating} star{rating === 1 ? '' : 's'}.
          </p>
          {comment ? <p className="mt-2 text-xs">&ldquo;{comment}&rdquo;</p> : null}
        </div>
      ) : null}

      {!isSubmitted && !showComment && rating > 0 && rating < 5 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Add a comment to submit a rating below 5 stars.
        </p>
      ) : null}

      {!isSubmitted && !canSubmit ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Feedback is unavailable for this session.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
