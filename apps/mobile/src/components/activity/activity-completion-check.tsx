import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, CheckCircle2, XCircle } from 'lucide-react-native';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import {
  confirmSessionCompletion,
  disputeSessionCompletion,
  undoSessionCompletion,
} from '@/lib/api/session-completions';
import { ActivityFeedbackRequest } from '@/components/activity/activity-feedback-request';

type Step =
  | 'prompt'
  | 'dispute_form'
  | 'submitting_confirm'
  | 'submitting_dispute'
  | 'confirmed'
  | 'disputed'
  | 'already_responded';

type DisputeCategory = 'teacher_absent' | 'student_absent' | 'technical_issue' | 'other';
type CompletionStatus = 'pending' | 'confirmed' | 'disputed' | 'auto_confirmed';

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
      ? (sessionCompletion.status as CompletionStatus)
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
  colors: AppColors;
  currentProfileId?: string | null;
  onCompletionSubmit?: (status: 'confirmed' | 'disputed') => void;
  onRatingSubmit?: () => void;
  /**
   * When true, drops the left indent kept for aligning under an avatar in the
   * notification feed — the card keeps its own border/background (matching
   * SessionCard's look in the homepage's Today/This week/Next week sections) but
   * fills the full width instead of appearing shifted right. The default (false)
   * keeps the standalone notification-feed appearance unchanged.
   */
  embedded?: boolean;
};

function getInitialStep(status: CompletionStatus | null): Step {
  if (status === 'confirmed' || status === 'auto_confirmed') return 'confirmed';
  if (status === 'disputed') return 'already_responded';
  return 'prompt';
}

export function ActivityCompletionCheck({
  activity,
  colors,
  onCompletionSubmit,
  onRatingSubmit,
  embedded = false,
}: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const metadata = useMemo(() => getMetadata(activity), [activity]);
  const cardStyle = [styles.card, embedded && styles.cardEmbedded];

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
        // After a fresh in-session submit (confirmed/disputed), don't revert to already_responded
        if (prev === 'confirmed' || prev === 'disputed') return prev;
        return getInitialStep(metadata.sessionCompletionStatus);
      });
    }
  }, [metadata.sessionCompletionStatus]);

  // Mirrors ActivityFeedbackRequest's edit-window timer: close the Undo option once
  // UNDO_WINDOW_MS has elapsed since resolution, whether that's a fresh in-session
  // confirm/dispute or one resumed after a reload/remount.
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
    const timer = setTimeout(() => {
      setIsUndoWindowOpen(false);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [effectiveResolvedAt, metadata.hasRating]);

  const handleConfirm = useCallback(async () => {
    if (!canSubmit) return;
    setStep('submitting_confirm');
    setError(null);
    try {
      await confirmSessionCompletion({
        orgId: metadata.orgId,
        sessionCompletionId: metadata.sessionCompletionId!,
      });
      setLocalResolvedAt(new Date().toISOString());
      setStep('confirmed');
      onCompletionSubmit?.('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
      setStep('prompt');
    }
  }, [canSubmit, metadata, onCompletionSubmit]);

  const handleDisputeSubmit = useCallback(async () => {
    if (!canSubmit || !disputeCategory) return;
    setStep('submitting_dispute');
    setError(null);
    try {
      await disputeSessionCompletion({
        orgId: metadata.orgId,
        sessionCompletionId: metadata.sessionCompletionId!,
        disputeCategory,
        disputeReason: disputeReason.trim() || null,
        rescheduleRequested,
      });
      setLocalResolvedAt(new Date().toISOString());
      setStep('disputed');
      onCompletionSubmit?.('disputed');
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
    onCompletionSubmit,
  ]);

  const handleUndo = useCallback(async () => {
    if (!canSubmit || isUndoing) return;
    setIsUndoing(true);
    setError(null);
    try {
      await undoSessionCompletion({
        orgId: metadata.orgId,
        sessionCompletionId: metadata.sessionCompletionId!,
      });
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

  if (step === 'prompt' || step === 'submitting_confirm') {
    const isLoading = step === 'submitting_confirm';
    return (
      <View style={cardStyle}>
        {/* When embedded (the homepage tile), the tile itself already shows a
            "Completed" badge next to the session title — repeating "Session
            Completed" here would just say the same thing twice. */}
        {embedded ? null : (
          <Text style={[styles.question, { color: colors.textMuted }]}>
            {metadata.promptTitle}
          </Text>
        )}
        <Text style={[styles.promptBody, { color: colors.textMuted }]}>
          {metadata.promptBody}
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Confirm lesson"
            disabled={isLoading}
            onPress={() => void handleConfirm()}
            activeOpacity={0.8}
            style={[
              styles.yesButton,
              { backgroundColor: colors.teal, opacity: isLoading ? 0.7 : 1 },
            ]}
          >
            <CheckCircle2 size={16} color={colors.tealFg} />
            <Text style={styles.yesButtonText}>
              {isLoading ? 'Saving...' : 'Confirm Lesson'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Report a problem"
            disabled={isLoading}
            onPress={() => setStep('dispute_form')}
            activeOpacity={0.8}
            style={[
              styles.noButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                opacity: isLoading ? 0.7 : 1,
              },
            ]}
          >
            <XCircle size={16} color={colors.textMuted} />
            <Text style={[styles.noButtonText, { color: colors.textMuted }]}>
              Report a Problem
            </Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  if (step === 'confirmed') {
    return (
      <View style={cardStyle}>
        <View style={styles.confirmedHeaderRow}>
          <View style={styles.confirmedHeader}>
            <CheckCircle2 size={16} color={colors.teal} />
            <Text style={[styles.confirmedLabel, { color: colors.teal }]}>
              Great! How was the session?
            </Text>
          </View>
          {isUndoWindowOpen ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Undo"
              disabled={isUndoing}
              onPress={() => void handleUndo()}
              activeOpacity={0.7}
            >
              <Text style={[styles.undoText, { color: colors.textMuted }]}>
                {isUndoing ? 'Undoing...' : 'Undo'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {metadata.feedbackUiEnabled ? (
          <ActivityFeedbackRequest
            activity={activity}
            colors={colors}
            onRatingSubmit={onRatingSubmit}
          />
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  if (step === 'disputed') {
    return (
      <View style={[...cardStyle, !embedded && { backgroundColor: colors.inputBg }]}>
        <View style={styles.disputedRow}>
          <Text style={[styles.submittedText, { color: colors.textMuted }]}>
            {"Got it — we've notified the educator and admin team."}
          </Text>
          {isUndoWindowOpen ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Undo"
              disabled={isUndoing}
              onPress={() => void handleUndo()}
              activeOpacity={0.7}
            >
              <Text style={[styles.undoText, { color: colors.textMuted }]}>
                {isUndoing ? 'Undoing...' : 'Undo'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  if (step === 'already_responded') {
    return (
      <View style={[...cardStyle, !embedded && { backgroundColor: colors.inputBg }]}>
        <Text style={[styles.submittedText, { color: colors.textMuted }]}>
          {"You've already responded — thanks for letting us know!"}
        </Text>
      </View>
    );
  }

  // dispute_form or submitting_dispute
  const isSubmittingDispute = step === 'submitting_dispute';
  return (
    <View style={cardStyle}>
      <Text style={[styles.question, { color: colors.textMuted }]}>What happened?</Text>
      <View style={styles.chipRow}>
        {DISPUTE_CATEGORIES.map((cat) => {
          const isActive = disputeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              accessibilityRole="button"
              accessibilityLabel={cat.label}
              onPress={() => {
                setDisputeCategory(cat.key);
                if (cat.key === 'teacher_absent') {
                  setRescheduleRequested(true);
                }
              }}
              activeOpacity={0.8}
              style={[
                styles.chip,
                {
                  borderColor: isActive ? colors.teal : colors.border,
                  backgroundColor: isActive ? colors.tealBg : colors.inputBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? colors.teal : colors.textMuted },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {disputeCategory ? (
        <>
          <TextInput
            value={disputeReason}
            onChangeText={setDisputeReason}
            placeholder="Tell us what happened... (optional)"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={200}
            style={[
              styles.reasonInput,
              {
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                color: colors.text,
              },
            ]}
          />
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rescheduleRequested }}
            accessibilityLabel="Request reschedule"
            onPress={() => setRescheduleRequested((v) => !v)}
            activeOpacity={0.8}
            style={styles.rescheduleRow}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: rescheduleRequested ? colors.teal : colors.border,
                  backgroundColor: rescheduleRequested ? colors.teal : colors.inputBg,
                },
              ]}
            >
              {rescheduleRequested ? (
                <Check size={13} color={colors.tealFg} strokeWidth={3.5} />
              ) : null}
            </View>
            <View style={styles.rescheduleLabelButton}>
              <Text style={[styles.rescheduleLabel, { color: colors.text }]}>
                Request reschedule
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Submit dispute"
            disabled={isSubmittingDispute}
            onPress={() => void handleDisputeSubmit()}
            activeOpacity={0.8}
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.teal,
                opacity: isSubmittingDispute ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.submitButtonText}>
              {isSubmittingDispute ? 'Submitting...' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      marginTop: 10,
      marginLeft: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 16,
      gap: 12,
    },
    cardEmbedded: {
      // Drop this component's own chrome entirely — used inside
      // SessionCompletedTile, which now supplies ONE outer card (date chip +
      // title + meta + this widget). Keeping a second nested border/background
      // here produced two visually disconnected boxes once the homepage carousel
      // switched to a peeking card-stack, since the stack's placeholder cards are
      // sized to the tile's full bounding box, not just this inner widget.
      marginTop: 0,
      marginLeft: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      padding: 0,
    },
    question: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.4,
    },
    promptBody: {
      fontSize: 13,
      lineHeight: 19,
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    yesButton: {
      flex: 1,
      maxWidth: 200,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 38,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    yesButtonText: {
      color: colors.tealFg,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    noButton: {
      flex: 1,
      maxWidth: 200,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 38,
      borderRadius: 8,
      borderWidth: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    noButtonText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    confirmedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    confirmedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    confirmedLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
    disputedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    undoText: {
      fontSize: 13,
      fontWeight: '600',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderWidth: 1,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
    },
    reasonInput: {
      minHeight: 80,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    rescheduleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rescheduleLabelButton: {
      flex: 1,
      minHeight: 32,
      justifyContent: 'center',
    },
    rescheduleLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    submitButton: {
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    submittedText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
    },
    alreadyRespondedText: {
      fontSize: 12,
      lineHeight: 16,
      fontStyle: 'italic',
    },
    errorText: {
      fontSize: 13,
      color: '#dc2626',
    },
  });
}
