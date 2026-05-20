import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, CheckCircle2, XCircle } from 'lucide-react-native';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import { submitCompletionVote } from '@/lib/api/activity-feed/completion-vote';
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
  colors: AppColors;
  currentProfileId?: string | null;
  onCompletionSubmit?: (status: CompletionVoteStatus) => void;
};

function getInitialStep(status: CompletionVoteStatus | null): Step {
  if (status === 'confirmed' || status === 'disputed') return 'already_responded';
  return 'prompt';
}

export function ActivityCompletionCheck({
  activity,
  colors,
  currentProfileId,
  onCompletionSubmit,
}: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        // After a fresh in-session submit (confirmed/disputed), don't revert to already_responded
        if (prev === 'confirmed' || prev === 'disputed') return prev;
        return getInitialStep(metadata.completionVoteStatus);
      });
    }
  }, [metadata.completionVoteStatus]);

  const handleConfirm = useCallback(async () => {
    if (!canSubmit) return;
    setStep('submitting_confirm');
    setError(null);
    try {
      await submitCompletionVote({
        orgId: metadata.orgId,
        scheduleId: metadata.scheduleId!,
        occurrenceKey: metadata.occurrenceStart!,
        role: metadata.role,
        status: 'confirmed',
      });
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
      await submitCompletionVote({
        orgId: metadata.orgId,
        scheduleId: metadata.scheduleId!,
        occurrenceKey: metadata.occurrenceStart!,
        role: metadata.role,
        status: 'disputed',
        disputeCategory,
        disputeReason: disputeReason.trim() || null,
        rescheduleRequested,
      });
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

  if (step === 'prompt' || step === 'submitting_confirm') {
    const isLoading = step === 'submitting_confirm';
    return (
      <View style={styles.card}>
        <Text style={[styles.question, { color: colors.textMuted }]}>
          {metadata.promptTitle}
        </Text>
        <Text style={[styles.promptBody, { color: colors.textMuted }]}>
          {metadata.promptBody}
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Yes, the class happened"
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
              {isLoading ? 'Saving...' : 'Yes, it happened'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="No, the class did not happen"
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
              {"No, it didn't"}
            </Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  if (step === 'confirmed') {
    return (
      <View style={styles.card}>
        <View style={styles.confirmedHeader}>
          <CheckCircle2 size={16} color={colors.teal} />
          <Text style={[styles.confirmedLabel, { color: colors.teal }]}>
            Great! How was the session?
          </Text>
        </View>
        {metadata.feedbackUiEnabled ? (
          <ActivityFeedbackRequest
            activity={activity}
            colors={colors}
            currentProfileId={currentProfileId}
          />
        ) : null}
      </View>
    );
  }

  if (step === 'disputed') {
    return (
      <View style={[styles.card, { backgroundColor: colors.inputBg }]}>
        <Text style={[styles.submittedText, { color: colors.textMuted }]}>
          {"Got it — we've notified the educator and admin team."}
        </Text>
      </View>
    );
  }

  if (step === 'already_responded') {
    return (
      <View style={[styles.card, { backgroundColor: colors.inputBg }]}>
        <Text style={[styles.submittedText, { color: colors.textMuted }]}>
          {"You've already responded — thanks for letting us know!"}
        </Text>
      </View>
    );
  }

  // dispute_form or submitting_dispute
  const isSubmittingDispute = step === 'submitting_dispute';
  return (
    <View style={styles.card}>
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
      gap: 8,
    },
    yesButton: {
      flex: 1,
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
    confirmedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    confirmedLabel: {
      fontSize: 13,
      fontWeight: '700',
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
