import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
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
  | 'disputed';

type DisputeCategory = 'teacher_absent' | 'student_absent' | 'technical_issue' | 'other';

const DISPUTE_CATEGORIES: { key: DisputeCategory; label: string }[] = [
  { key: 'teacher_absent', label: 'Teacher absent' },
  { key: 'student_absent', label: 'Student absent' },
  { key: 'technical_issue', label: 'Technical issue' },
  { key: 'other', label: 'Other' },
];

function getMetadata(activity: ActivityFeedLeafItemVM) {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  return {
    orgId: typeof m.orgId === 'string' ? m.orgId : activity.ids.orgId,
    scheduleId: typeof m.scheduleId === 'string' ? m.scheduleId : null,
    occurrenceStart: typeof m.occurrenceStart === 'string' ? m.occurrenceStart : null,
    role: typeof m.roleContext === 'string' ? m.roleContext : 'child',
    feedbackUiEnabled: m.feedbackUiEnabled !== false,
  };
}

type Props = {
  activity: ActivityFeedLeafItemVM;
  colors: AppColors;
  currentProfileId?: string | null;
};

export function ActivityCompletionCheck({ activity, colors, currentProfileId }: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const metadata = useMemo(() => getMetadata(activity), [activity]);

  const [step, setStep] = useState<Step>('prompt');
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategory | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [rescheduleRequested, setRescheduleRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(metadata.scheduleId && metadata.occurrenceStart);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
      setStep('prompt');
    }
  }, [canSubmit, metadata]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
      setStep('dispute_form');
    }
  }, [canSubmit, disputeCategory, disputeReason, metadata, rescheduleRequested]);

  if (step === 'prompt' || step === 'submitting_confirm') {
    const isLoading = step === 'submitting_confirm';
    return (
      <View style={styles.card}>
        <Text style={[styles.question, { color: colors.textMuted }]}>
          Did this class take place?
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yes, the class happened"
            disabled={isLoading}
            onPress={() => void handleConfirm()}
            style={({ pressed }) => [
              styles.yesButton,
              { backgroundColor: colors.teal, opacity: isLoading || pressed ? 0.7 : 1 },
            ]}
          >
            <CheckCircle2 size={15} color="#ffffff" />
            <Text style={styles.yesButtonText}>
              {isLoading ? 'Saving...' : 'Yes, it happened'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="No, the class did not happen"
            disabled={isLoading}
            onPress={() => setStep('dispute_form')}
            style={({ pressed }) => [
              styles.noButton,
              { borderColor: colors.border, opacity: isLoading || pressed ? 0.7 : 1 },
            ]}
          >
            <XCircle size={15} color={colors.textMuted} />
            <Text style={[styles.noButtonText, { color: colors.textMuted }]}>
              {"No, it didn't"}
            </Text>
          </Pressable>
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

  // dispute_form or submitting_dispute
  const isSubmittingDispute = step === 'submitting_dispute';
  return (
    <View style={styles.card}>
      <Text style={[styles.question, { color: colors.textMuted }]}>What happened?</Text>
      <View style={styles.chipRow}>
        {DISPUTE_CATEGORIES.map((cat) => {
          const isActive = disputeCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              accessibilityRole="button"
              accessibilityLabel={cat.label}
              onPress={() => {
                setDisputeCategory(cat.key);
                if (cat.key === 'teacher_absent') {
                  setRescheduleRequested(true);
                }
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: isActive ? colors.teal : colors.border,
                  backgroundColor: isActive ? `${colors.teal}22` : colors.card,
                  opacity: pressed ? 0.75 : 1,
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
            </Pressable>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle reschedule request"
            onPress={() => setRescheduleRequested((v) => !v)}
            style={styles.rescheduleRow}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: rescheduleRequested ? colors.teal : colors.border,
                  backgroundColor: rescheduleRequested ? colors.teal : 'transparent',
                },
              ]}
            />
            <Text style={[styles.rescheduleLabel, { color: colors.text }]}>
              Request reschedule
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit dispute"
            disabled={isSubmittingDispute}
            onPress={() => void handleDisputeSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: colors.teal,
                opacity: isSubmittingDispute || pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.submitButtonText}>
              {isSubmittingDispute ? 'Submitting...' : 'Submit'}
            </Text>
          </Pressable>
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
      padding: 14,
      gap: 10,
    },
    question: {
      fontSize: 13,
      fontWeight: '600',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    yesButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    yesButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    noButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    noButtonText: {
      fontSize: 13,
      fontWeight: '600',
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
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
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
    errorText: {
      fontSize: 13,
      color: '#dc2626',
    },
  });
}
