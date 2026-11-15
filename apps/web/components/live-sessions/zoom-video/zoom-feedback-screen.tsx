'use client';

import { Angry, Frown, Laugh, Loader2, Meh, Smile } from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';

const RATINGS = [
  { rating: 1, label: 'Terrible', icon: Angry },
  { rating: 2, label: 'Poor', icon: Frown },
  { rating: 3, label: 'Okay', icon: Meh },
  { rating: 4, label: 'Good', icon: Smile },
  { rating: 5, label: 'Great', icon: Laugh },
] as const;

export function ZoomFeedbackScreen({
  rating,
  isSubmitting,
  onRatingChange,
  onSubmit,
  onSkip,
}: {
  rating: number | null;
  isSubmitting: boolean;
  onRatingChange: (rating: number) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-xl sm:p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">How was your session?</h1>
          <p className="text-sm text-muted-foreground">
            Your feedback helps us improve future sessions.
          </p>
        </div>
        <div
          className="mt-8 flex w-full flex-row items-stretch justify-center gap-1 sm:gap-2"
          role="radiogroup"
          aria-label="Session rating"
        >
          {RATINGS.map(({ rating: value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              onClick={() => onRatingChange(value)}
              className={cn(
                'flex min-w-0 flex-1 basis-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl px-1 py-3 text-xs text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                rating === value && 'bg-accent text-foreground',
              )}
            >
              <Icon className={cn('size-7', rating === value && 'text-primary')} />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onSkip}>
            Skip
          </Button>
          <Button
            type="button"
            disabled={rating === null || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Submit
          </Button>
        </div>
      </section>
    </main>
  );
}
