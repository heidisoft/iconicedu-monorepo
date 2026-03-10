import { memo, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import type { FeedbackRequestMessageVM as FeedbackRequestMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface FeedbackRequestMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: FeedbackRequestMessageType;
}

export const FeedbackRequestMessage = memo(function FeedbackRequestMessage(
  props: FeedbackRequestMessageProps,
) {
  const { message, ...baseProps } = props;
  const { feedback } = message;

  const initialRating = feedback.rating ?? 0;
  const initialComment = feedback.comment ?? '';
  const hasInitialSubmit = Boolean(feedback.submittedAt || feedback.rating);

  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [isSubmitted, setIsSubmitted] = useState(hasInitialSubmit);
  const [showComment, setShowComment] = useState(
    !hasInitialSubmit && initialRating > 0 && initialRating < 5,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFiveStar = rating === 5;
  const canSubmit =
    typeof feedback.classSessionId === 'string' &&
    feedback.classSessionId.length > 0 &&
    typeof feedback.classroomId === 'string' &&
    feedback.classroomId.length > 0 &&
    typeof feedback.channelId === 'string' &&
    feedback.channelId.length > 0;

  const headerLabel = useMemo(() => {
    if (feedback.sessionTitle) {
      return `Feedback for ${feedback.sessionTitle}`;
    }
    return 'Quick feedback';
  }, [feedback.sessionTitle]);

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
          orgId: message.ids.orgId,
          classSessionId: feedback.classSessionId,
          classroomId: feedback.classroomId,
          channelId: feedback.channelId,
          messageId: message.ids.id,
          sourceEventId: feedback.sourceEventId ?? null,
          occurrenceStartAt: feedback.occurrenceStart ?? null,
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

      setRating(nextRating);
      setComment(nextComment ?? '');
      setIsSubmitted(true);
      setShowComment(false);
    } catch {
      setError('Unable to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectRating = async (value: number) => {
    if (isSubmitted || isSubmitting) return;
    setRating(value);

    if (value === 5) {
      await submitFeedback(value);
      return;
    }

    setShowComment(true);
  };

  const handleSubmit = async () => {
    if (isSubmitted || isSubmitting || rating === 0) return;
    await submitFeedback(rating, comment);
  };

  return (
    <MessageBase message={message} {...baseProps} className="bg-primary/5">
      <div className="mt-2 rounded-xl border border-border bg-card p-4 max-w-sm">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {headerLabel}
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">{feedback.prompt}</p>

        <div className="mt-3 flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, index) => {
            const value = index + 1;
            const isActive = value <= rating;
            return (
              <button
                key={value}
                type="button"
                onClick={() => void handleSelectRating(value)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border border-border transition',
                  isSubmitted || isSubmitting
                    ? 'cursor-default'
                    : 'hover:border-primary/40 hover:bg-primary/10',
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

        {isSubmitted ? (
          <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Thanks for the feedback!</p>
            <p className="mt-1">
              {rating > 0
                ? `You rated this ${rating} star${rating === 1 ? '' : 's'}.`
                : 'Feedback submitted.'}
            </p>
            {comment ? <p className="mt-1">“{comment}”</p> : null}
          </div>
        ) : null}

        {!isSubmitted && showComment ? (
          <div className="mt-3 space-y-2">
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Tell us what could be better..."
              className="min-h-[96px]"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={rating === 0 || isSubmitting}
            >
              Submit feedback
            </Button>
          </div>
        ) : null}

        {!isSubmitted && !showComment && rating > 0 && !isFiveStar ? (
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => setShowComment(true)}>
              Add comment
            </Button>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

        {!isSubmitted && !canSubmit ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Feedback is unavailable for this session.
          </p>
        ) : null}

        {!isSubmitted && rating === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Select a rating to continue.
          </p>
        ) : null}
      </div>
    </MessageBase>
  );
});
