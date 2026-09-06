'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { ActivityFeedbackRequest } from '@iconicedu/ui-web/components/notification/activity-feedback-request';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';

type Step =
  | 'prompt'
  | 'dispute_form'
  | 'submitting'
  | 'confirmed'
  | 'disputed'
  | 'already_responded';
type DisputeCategory = 'teacher_absent' | 'student_absent' | 'technical_issue' | 'other';
type CompletionVoteStatus = 'confirmed' | 'disputed';

const DISPUTE_CATEGORIES: { key: DisputeCategory; label: string }[] = [
  { key: 'teacher_absent', label: 'Teacher absent' },
  { key: 'student_absent', label: 'Student absent' },
  { key: 'technical_issue', label: 'Technical issue' },
  { key: 'other', label: 'Other' },
];

function getMetadata(activity: ActivityFeedLeafItemVM) {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  const vote =
    m.completionVote && typeof m.completionVote === 'object'
      ? (m.completionVote as Record<string, unknown>)
      : null;
  const completionVoteStatus =
    vote?.status === 'confirmed' || vote?.status === 'disputed'
      ? (vote.status as CompletionVoteStatus)
      : null;
  return {
    orgId: typeof m.orgId === 'string' ? m.orgId : activity.ids.orgId,
    scheduleId: typeof m.scheduleId === 'string' ? m.scheduleId : null,
    occurrenceStart: typeof m.occurrenceStart === 'string' ? m.occurrenceStart : null,
    role: typeof m.roleContext === 'string' ? m.roleContext : 'child',
    promptTitle:
      typeof m.completionPromptTitle === 'string'
        ? m.completionPromptTitle
        : 'Confirm your lesson',
    promptBody:
      typeof m.completionPromptBody === 'string'
        ? m.completionPromptBody
        : 'How did your class go? Confirm, leave feedback, or report a problem.',
    feedbackUiEnabled: m.feedbackUiEnabled !== false,
    completionVoteStatus,
  };
}

type Props = {
  activity: ActivityFeedLeafItemVM;
  onVoteSubmit?: () => void;
};

export function canRenderActivityCompletionCheck(activity: ActivityFeedLeafItemVM) {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  return (
    m.completionCheckUiEnabled === true &&
    typeof m.scheduleId === 'string' &&
    typeof m.occurrenceStart === 'string'
  );
}

function getInitialStep(status: CompletionVoteStatus | null): Step {
  if (status === 'confirmed' || status === 'disputed') return 'already_responded';
  return 'prompt';
}

export function ActivityCompletionCheck({ activity, onVoteSubmit }: Props) {
  const metadata = useMemo(() => getMetadata(activity), [activity]);
  const [step, setStep] = useState<Step>(() =>
    getInitialStep(metadata.completionVoteStatus),
  );
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [rescheduleRequested, setRescheduleRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(metadata.scheduleId && metadata.occurrenceStart);

  useEffect(() => {
    if (metadata.completionVoteStatus) {
      setStep((prev) => {
        if (prev === 'confirmed' || prev === 'disputed') return prev;
        return getInitialStep(metadata.completionVoteStatus);
      });
    }
  }, [metadata.completionVoteStatus]);

  const handleConfirm = useCallback(async () => {
    if (!canSubmit) return;
    setStep('submitting');
    setError(null);
    try {
      const response = await fetch('/api/activity-feed/session-completion-vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orgId: metadata.orgId,
          scheduleId: metadata.scheduleId,
          occurrenceKey: metadata.occurrenceStart,
          role: metadata.role,
          status: 'confirmed',
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? 'Failed to submit');
      }
      setStep('confirmed');
      onVoteSubmit?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
      setStep('prompt');
    }
  }, [canSubmit, metadata, onVoteSubmit]);

  const handleDisputeSubmit = useCallback(async () => {
    if (!canSubmit || !disputeCategory) return;
    setStep('submitting');
    setError(null);
    try {
      const response = await fetch('/api/activity-feed/session-completion-vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orgId: metadata.orgId,
          scheduleId: metadata.scheduleId,
          occurrenceKey: metadata.occurrenceStart,
          role: metadata.role,
          status: 'disputed',
          disputeCategory,
          disputeReason: disputeReason.trim() || null,
          rescheduleRequested,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? 'Failed to submit');
      }
      setStep('disputed');
      onVoteSubmit?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
      setStep('dispute_form');
    }
  }, [
    canSubmit,
    disputeCategory,
    disputeReason,
    metadata,
    rescheduleRequested,
    onVoteSubmit,
  ]);

  if (step === 'prompt' || (step === 'submitting' && disputeCategory === null)) {
    const isLoading = step === 'submitting';
    return (
      <div className="w-full rounded-xl border border-border/80 bg-background/95 p-4 md:max-w-[420px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {metadata.promptTitle}
        </p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {metadata.promptBody}
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={isLoading}
            data-action-button="true"
            className="flex-1 gap-1.5"
          >
            <CheckCircle2 className="size-3.5" />
            {isLoading ? 'Saving...' : 'Confirm Lesson'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStep('dispute_form')}
            disabled={isLoading}
            data-action-button="true"
            className="flex-1 gap-1.5"
          >
            <XCircle className="size-3.5" />
            Report a Problem
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (step === 'already_responded') {
    return (
      <div className="w-full rounded-xl border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground md:max-w-[420px]">
        You&apos;ve already responded — thanks for letting us know!
      </div>
    );
  }

  if (step === 'confirmed') {
    return (
      <div className="w-full rounded-xl border border-border/80 bg-background/95 p-4 md:max-w-[420px]">
        <div className="mb-3 flex items-center gap-1.5">
          <CheckCircle2 className="size-4 text-success" />
          <p className="text-sm font-semibold text-success">
            Great! How was the session?
          </p>
        </div>
        {metadata.feedbackUiEnabled ? (
          <ActivityFeedbackRequest activity={activity} />
        ) : null}
      </div>
    );
  }

  if (step === 'disputed') {
    return (
      <div className="w-full rounded-xl border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground md:max-w-[420px]">
        Reported — the educator and admin team have been notified.
      </div>
    );
  }

  // dispute_form
  const isSubmitting = step === 'submitting';
  return (
    <div className="w-full rounded-xl border border-border/80 bg-background/95 p-4 md:max-w-[420px]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        What happened?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DISPUTE_CATEGORIES.map((cat) => {
          const isActive = disputeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setDisputeCategory(cat.key);
                if (cat.key === 'teacher_absent') {
                  setRescheduleRequested(true);
                }
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                isActive
                  ? 'border-success bg-success/10 text-success'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30',
              )}
              data-action-button="true"
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {disputeCategory ? (
        <div className="mt-3 space-y-3">
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Tell us what happened... (optional)"
            maxLength={200}
            className="min-h-[80px] text-xs placeholder:text-xs"
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={rescheduleRequested}
              onChange={(e) => setRescheduleRequested(e.target.checked)}
              className="size-3.5 rounded border-border accent-success"
            />
            Request reschedule
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleDisputeSubmit()}
            disabled={isSubmitting}
            data-action-button="true"
            className="w-full"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
