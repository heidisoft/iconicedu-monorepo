import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@iconicedu/ui-native';
import type {
  ClassSessionCompletionDisputeCategory,
  SessionCompletionConfirmedBy,
  SessionCompletionVM,
} from '@iconicedu/shared-types';
import { reportSessionCompletion } from '@/lib/api/session-completions';
import type { AppColors } from '@/lib/theme';

// Same categories (and wording) as the pending-session dispute form in
// ActivityCompletionCheck, so staff see one consistent set of reasons.
const REPORT_CATEGORIES: Array<{
  key: ClassSessionCompletionDisputeCategory;
  label: string;
}> = [
  { key: 'did_not_happen', label: 'Session did not happen' },
  { key: 'teacher_absent', label: 'Teacher absent' },
  { key: 'student_absent', label: 'Student absent' },
  { key: 'technical_issue', label: 'Technical issue' },
  { key: 'other', label: 'Other' },
];

const REASON_MAX_LENGTH = 500;

type Props = {
  completion: SessionCompletionVM | null;
  confirmedBy: SessionCompletionConfirmedBy | null;
  colors: AppColors;
  onClose: () => void;
  onReported: (completionId: string) => void;
};

export function ReportCompletionSheet({
  completion,
  confirmedBy,
  colors,
  onClose,
  onReported,
}: Props) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<ClassSessionCompletionDisputeCategory | null>(
    null,
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start every report fresh.
  useEffect(() => {
    setCategory(null);
    setReason('');
    setError(null);
    setSubmitting(false);
  }, [completion?.id]);

  const handleSubmit = async () => {
    if (!completion || !category || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportSessionCompletion({
        orgId: completion.orgId,
        sessionCompletionId: completion.id,
        reportCategory: category,
        reportReason: reason.trim() || null,
      });
      onReported(completion.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  };

  const explanation =
    confirmedBy === 'staff'
      ? 'Staff marked this session as complete for you.'
      : 'This session was marked complete automatically after the confirmation window closed.';

  return (
    <BottomSheet
      visible={completion !== null}
      onClose={onClose}
      topInset={insets.top}
      bottomInset={insets.bottom}
      backdropColor={colors.modalOverlay}
      sheetStyle={{ backgroundColor: colors.pageBg }}
      dragHandleStyle={{ backgroundColor: colors.border }}
      testID="report-completion-sheet"
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Report this session</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {`${explanation} If that's wrong, tell us what happened. Staff will review it; the session stays completed until they do.`}
        </Text>

        <View accessibilityRole="radiogroup" style={styles.options}>
          {REPORT_CATEGORIES.map(({ key, label }) => {
            const selected = key === category;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? colors.action : colors.border,
                    backgroundColor: selected ? colors.actionSubtle : colors.card,
                  },
                ]}
                onPress={() => setCategory(key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={label}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: selected ? colors.action : colors.textFaint },
                  ]}
                >
                  {selected ? (
                    <View style={[styles.radioDot, { backgroundColor: colors.action }]} />
                  ) : null}
                </View>
                <Text style={[styles.optionText, { color: colors.text }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Add details (optional)"
          placeholderTextColor={colors.textFaint}
          maxLength={REASON_MAX_LENGTH}
          multiline
          accessibilityLabel="Report details"
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
            },
          ]}
        />

        {error ? (
          <Text style={[styles.error, { color: colors.red }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.submit,
            {
              backgroundColor: colors.action,
              opacity: category && !submitting ? 1 : 0.5,
            },
          ]}
          onPress={() => void handleSubmit()}
          disabled={!category || submitting}
          accessibilityRole="button"
          accessibilityLabel="Submit report"
          accessibilityState={{ disabled: !category || submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={colors.actionForeground} />
          ) : (
            <Text style={[styles.submitText, { color: colors.actionForeground }]}>
              Submit report
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { fontSize: 15, fontWeight: '500' },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  error: { fontSize: 13 },
  submit: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '700' },
});
