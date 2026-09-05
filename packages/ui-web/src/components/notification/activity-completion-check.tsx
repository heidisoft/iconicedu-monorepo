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
type SessionCompletionStatus = 'pending' | 'confirmed' | 'disputed' | 'auto_confirmed';

// Same window ActivityFeedbackRequest already uses for its "Edit rating" button —
// applied here to let a fresh confirm/dispute be undone for a short time.
const UNDO_WINDOW_MS = 60_000;

function resolveUndoWindowOpen(resolvedAt: string | null) {
  if (!resolvedAt) return false;
  const resolvedTimestamp = new Date(resolvedAt).getTime();
  if (Number.isNaN(resolvedTimestamp)) return false;
  return resolvedTimestamp + UNDO_WINDOW_MS > Date.now();
}

const DISPUTE_CATEGORIES: { key: DisputeCategory; label: string }[] = [
  { key: 'teacher_absent', label: 'Teacher absent' },
  { key: 'student_absent', label: 'Student absent' },
  { key: 'technical_issue', label: 'Technical issue' },
  { key: 'other', label: 'Other' },
];

function getMetadata(activity: ActivityFeedLeafItemVM) {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  const sessionCompletion =
    m.sessionCompletion && typeof m.sessionCompletion === 'object'
      ? (m.sessionCompletion as Record<string, unknown>)
      : null;
  const sessionCompletionStatus =
    sessionCompletion?.status === 'pending' ||
    sessionCompletion?.status === 'confirmed' ||
    sessionCompletion?.status === 'disputed' ||
    sessionCompletion?.status === 'auto_confirmed'
      ? (sessionCompletion.status as SessionCompletionStatus)
      : null;
  return {
    orgId: typeof m.orgId === 'string' ? m.orgId : activity.ids.orgId,
    sessionCompletionId:
      typeof sessionCompletion?.id === 'string'
        ? sessionCompletion.id
        : typeof m.sessionCompletionId === 'string'
          ? m.sessionCompletionId
          : null,
    promptTitle:
      typeof m.completionPromptTitle === 'string'
        ? m.completionPromptTitle
        : 'Confirm your lesson',
    promptBody:
      typeof m.completionPromptBody === 'string'
        ? m.completionPromptBody
        : 'How did your class go? Confirm, leave feedback, or report a problem.',
    feedbackUiEnabled: m.feedbackUiEnabled !== false,
    sessionCompletionStatus,
    resolvedAt:
      typeof sessionCompletion?.resolvedAt === 'string'
        ? sessionCompletion.resolvedAt
        : null,
    hasRating: typeof sessionCompletion?.rating === 'number',
  };
}

type Props = {
  activity: ActivityFeedLeafItemVM;
  onVoteSubmit?: (status: 'confirmed' | 'disputed') => void;
  onRatingSubmit?: () => void;
};

export function canRenderActivityCompletionCheck(activity: ActivityFeedLeafItemVM) {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  return (
    m.completionCheckUiEnabled === true &&
    (typeof m.sessionCompletionId === 'string' ||
      (typeof m.sessionCompletion === 'object' && m.sessionCompletion !== null))
  );
}

function getInitialStep(status: SessionCompletionStatus | null): Step {
  if (status === 'confirmed' || status === 'auto_confirmed') return 'confirmed';
  if (status === 'disputed') return 'already_responded';
  return 'prompt';
}

export function ActivityCompletionCheck({
  activity,
  onVoteSubmit,
  onRatingSubmit,
}: Props) {
  const metadata = useMemo(() => getMetadata(activity), [activity]);
  const [step, setStep] = useState<Step>(() =>
    getInitialStep(metadata.sessionCompletionStatus),
  );
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [rescheduleRequested, setRescheduleRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localResolvedAt, setLocalResolvedAt] = useState<string | null>(null);
  const effectiveResolvedAt = localResolvedAt ?? metadata.resolvedAt;
  const [isUndoWindowOpen, setIsUndoWindowOpen] = useState(
    () => resolveUndoWindowOpen(effectiveResolvedAt) && !metadata.hasRating,
  );
  const [isUndoing, setIsUndoing] = useState(false);

  const canSubmit = Boolean(metadata.sessionCompletionId);

  useEffect(() => {
    if (metadata.sessionCompletionStatus) {
      setStep((prev) => {
        if (prev === 'confirmed' || prev === 'disputed') return prev;
        return getInitialStep(metadata.sessionCompletionStatus);
      });
    }
  }, [metadata.sessionCompletionStatus]);

  // Mirrors ActivityFeedbackRequest's edit-window timer: close the Undo option once
  // UNDO_WINDOW_MS has elapsed since resolution, whether that's a fresh in-session
  // confirm/dispute or one resumed after a reload.
  useEffect(() => {
    if (metadata.hasRating) {
      setIsUndoWindowOpen(false);
      return;
    }
    if (!effectiveResolvedAt) {
      setIsUndoWindowOpen(false);
      return;
    }

    const resolvedTimestamp = new Date(effectiveResolvedAt).getTime();
    if (Number.isNaN(resolvedTimestamp)) {
      setIsUndoWindowOpen(false);
      return;
    }

    const remainingMs = resolvedTimestamp + UNDO_WINDOW_MS - Date.now();
    if (remainingMs <= 0) {
      setIsUndoWindowOpen(false);
      return;
    }

    setIsUndoWindowOpen(true);
    const timer = window.setTimeout(() => {
      setIsUndoWindowOpen(false);
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [effectiveResolvedAt, metadata.hasRating]);

  const handleConfirm = useCallback(async () => {
    if (!canSubmit) return;
    setStep('submitting');
    setError(null);
    try {
      const response = await fetch(
        `/api/session-completions/${metadata.sessionCompletionId}/confirm`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            orgId: metadata.orgId,
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? 'Failed to submit');
      }
      setLocalResolvedAt(new Date().toISOString());
      setStep('confirmed');
      onVoteSubmit?.('confirmed');
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
      const response = await fetch(
        `/api/session-completions/${metadata.sessionCompletionId}/dispute`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            orgId: metadata.orgId,
            disputeCategory,
            disputeReason: disputeReason.trim() || null,
            rescheduleRequested,
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? 'Failed to submit');
      }
      setLocalResolvedAt(new Date().toISOString());
      setStep('disputed');
      onVoteSubmit?.('disputed');
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

  const handleUndo = useCallback(async () => {
    if (!canSubmit || isUndoing) return;
    setIsUndoing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/session-completions/${metadata.sessionCompletionId}/undo`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orgId: metadata.orgId }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? 'Failed to undo');
      }
      setLocalResolvedAt(null);
      setIsUndoWindowOpen(false);
      setDisputeCategory(null);
      setDisputeReason('');
      setRescheduleRequested(false);
      setStep('prompt');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo');
    } finally {
      setIsUndoing(false);
    }
  }, [canSubmit, isUndoing, metadata]);

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
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700">
              Great! How was the session?
            </p>
          </div>
          {isUndoWindowOpen ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void handleUndo()}
              disabled={isUndoing}
              data-action-button="true"
              className="text-xs"
            >
              {isUndoing ? 'Undoing...' : 'Undo'}
            </Button>
          ) : null}
        </div>
        {metadata.feedbackUiEnabled ? (
          <ActivityFeedbackRequest activity={activity} onRatingSubmit={onRatingSubmit} />
        ) : null}
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      </div>
    );
  }

  if (step === 'disputed') {
    return (
      <div className="w-full rounded-xl border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground md:max-w-[420px]">
        <div className="flex items-center justify-between gap-3">
          <p>Reported — the educator and admin team have been notified.</p>
          {isUndoWindowOpen ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void handleUndo()}
              disabled={isUndoing}
              data-action-button="true"
              className="shrink-0 text-xs"
            >
              {isUndoing ? 'Undoing...' : 'Undo'}
            </Button>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-rose-600">{error}</p> : null}
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
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
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
              className="size-3.5 rounded border-border accent-emerald-600"
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

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
