'use client';

import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';

type ActivityFeedbackRequestProps = {
  activity: ActivityFeedLeafItemVM;
};

function getInitialFeedback(activity: ActivityFeedLeafItemVM) {
  const feedback = activity.metadata?.feedbackResponse;
  if (!feedback || typeof feedback !== 'object') {
    return {
      rating: 0,
      comment: '',
      submittedAt: null as string | null,
    };
  }

  const source = feedback as Record<string, unknown>;
  return {
    rating: typeof source.rating === 'number' ? source.rating : 0,
    comment: typeof source.comment === 'string' ? source.comment : '',
    submittedAt: typeof source.submittedAt === 'string' ? source.submittedAt : null,
  };
}

export function ActivityFeedbackRequest({ activity }: ActivityFeedbackRequestProps) {
  const initial = useMemo(() => getInitialFeedback(activity), [activity]);
  const [rating, setRating] = useState(initial.rating);
  const [comment, setComment] = useState(initial.comment);
  const [submittedAt, setSubmittedAt] = useState<string | null>(initial.submittedAt);
  const [showComment, setShowComment] = useState(
    !initial.submittedAt && initial.rating > 0 && initial.rating < 5,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceEventId = activity.metadata?.sourceEventId;
  const messageId = activity.metadata?.messageId;
  const classSessionId = activity.metadata?.classSessionId;
  const classroomId = activity.metadata?.classroomId;
  const channelId = activity.metadata?.channelId;
  const occurrenceStart = activity.metadata?.occurrenceStart;
  const hasSource = typeof sourceEventId === 'string' && sourceEventId.length > 0;
  const hasMessage = typeof messageId === 'string' && messageId.length > 0;
  const canSubmit =
    (hasSource || hasMessage) &&
    typeof classSessionId === 'string' &&
    classSessionId.length > 0 &&
    typeof classroomId === 'string' &&
    classroomId.length > 0 &&
    typeof channelId === 'string' &&
    channelId.length > 0;
  const isSubmitted = Boolean(submittedAt);
  const isFiveStar = rating === 5;

  const submitFeedback = async (nextRating: number, nextComment?: string) => {
    if (!canSubmit || isSubmitted || nextRating < 1 || nextRating > 5) {
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
          classSessionId,
          classroomId,
          channelId,
          sourceEventId: hasSource ? sourceEventId : null,
          messageId: hasMessage ? messageId : null,
          occurrenceStartAt:
            typeof occurrenceStart === 'string' && occurrenceStart.length > 0
              ? occurrenceStart
              : null,
          rating: nextRating,
          comment: nextComment ?? null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        data?: { submittedAt?: string | null };
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Unable to submit feedback');
        return;
      }

      setSubmittedAt(payload?.data?.submittedAt ?? new Date().toISOString());
      setShowComment(false);
    } catch {
      setError('Unable to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectRating = async (value: number) => {
    if (isSubmitted || isSubmitting) {
      return;
    }

    setRating(value);
    if (value === 5) {
      await submitFeedback(value);
      return;
    }

    setShowComment(true);
  };

  const handleSubmit = async () => {
    if (isSubmitted || isSubmitting || rating < 1) {
      return;
    }
    await submitFeedback(rating, comment);
  };

  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, index) => {
          const value = index + 1;
          const isActive = value <= rating;
          return (
            <button
              key={value}
              type="button"
              onClick={() => void handleSelectRating(value)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border border-border transition',
                !isSubmitted &&
                  !isSubmitting &&
                  'hover:border-primary/40 hover:bg-primary/10',
              )}
              aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
              disabled={isSubmitted || isSubmitting || !canSubmit}
            >
              <Star
                className={cn(
                  'h-4 w-4 transition-colors',
                  isActive ? 'fill-primary text-primary' : 'text-muted-foreground',
                )}
              />
            </button>
          );
        })}
      </div>

      {!isSubmitted && showComment ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Tell us what could be better..."
            className="min-h-[84px]"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            Submit feedback
          </Button>
        </div>
      ) : null}

      {isSubmitted ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Thanks, your feedback was submitted.
        </p>
      ) : null}

      {!isSubmitted && rating > 0 && !isFiveStar && !showComment ? (
        <p className="mt-2 text-xs text-muted-foreground">Add a comment to submit.</p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
