import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Star } from 'lucide-react-native';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import { submitActivityFeedFeedback } from '@/lib/api/activity-feed/feedback';

const EDIT_WINDOW_MS = 60_000;
const COMMENT_AUTOSAVE_MS = 600;

type ActivityFeedbackRequestProps = {
  activity: ActivityFeedLeafItemVM;
  colors: AppColors;
  currentProfileId?: string | null;
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

function normalizeComment(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function canRenderMobileActivityFeedbackRequest(activity: ActivityFeedLeafItemVM) {
  return getFeedbackMetadata(activity).feedbackUiEnabled;
}

export function ActivityFeedbackRequest({
  activity,
  colors,
  currentProfileId,
}: ActivityFeedbackRequestProps) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const initialFeedback = useMemo(() => getInitialFeedback(activity), [activity]);
  const metadata = useMemo(() => getFeedbackMetadata(activity), [activity]);

  const [rating, setRating] = useState(initialFeedback.rating);
  const [comment, setComment] = useState(initialFeedback.comment);
  const [lastSavedComment, setLastSavedComment] = useState(initialFeedback.comment);
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    initialFeedback.submittedAt,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditWindowOpen, setIsEditWindowOpen] = useState(() =>
    resolveEditWindowOpen(initialFeedback.submittedAt),
  );
  const [isCommentSaving, setIsCommentSaving] = useState(false);
  const commentAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRating(initialFeedback.rating);
    setComment(initialFeedback.comment);
    setLastSavedComment(initialFeedback.comment);
    setSubmittedAt(initialFeedback.submittedAt);
    setError(null);
    setIsEditing(false);
    setIsEditWindowOpen(resolveEditWindowOpen(initialFeedback.submittedAt));
    setIsCommentSaving(false);
  }, [initialFeedback]);

  useEffect(() => {
    return () => {
      if (commentAutosaveTimerRef.current) {
        clearTimeout(commentAutosaveTimerRef.current);
      }
    };
  }, []);

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

    const timer = setTimeout(() => {
      setIsEditWindowOpen(false);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [submittedAt]);

  const hasSource = Boolean(metadata.sourceEventId);
  const hasMessage = Boolean(metadata.messageId);
  const canSubmit =
    metadata.feedbackUiEnabled &&
    (hasSource || hasMessage) &&
    Boolean(metadata.classSessionId) &&
    Boolean(metadata.classroomId) &&
    Boolean(metadata.channelId);
  const shouldShowCommentBox = canSubmit && rating > 0 && rating < 5;
  const isSubmitted = Boolean(submittedAt) && !isEditing && !shouldShowCommentBox;
  const normalizedDraftComment = normalizeComment(comment);
  const normalizedSavedComment = normalizeComment(lastSavedComment);
  const hasPendingCommentChanges =
    shouldShowCommentBox && normalizedDraftComment !== normalizedSavedComment;

  const submitFeedback = useCallback(
    async (
      nextRating: number,
      nextComment?: string,
      options?: { keepCommentOpen?: boolean; savingComment?: boolean },
    ) => {
      if (!canSubmit || nextRating < 1 || nextRating > 5) {
        return;
      }

      if (options?.savingComment) {
        setIsCommentSaving(true);
      } else {
        setIsSubmitting(true);
      }
      setError(null);
      try {
        const payload = await submitActivityFeedFeedback({
          orgId: activity.ids.orgId,
          classSessionId: metadata.classSessionId!,
          classroomId: metadata.classroomId!,
          channelId: metadata.channelId!,
          sourceEventId: hasSource ? metadata.sourceEventId : null,
          messageId: hasMessage ? metadata.messageId : null,
          occurrenceStartAt: metadata.occurrenceStart,
          rating: nextRating,
          comment: nextComment ?? null,
          recipientProfileId: currentProfileId ?? null,
        });

        const nextSubmittedAt = payload.submittedAt ?? new Date().toISOString();
        const nextResolvedComment = payload.comment ?? nextComment ?? '';
        setRating(nextRating);
        setLastSavedComment(nextResolvedComment);
        setSubmittedAt(nextSubmittedAt);
        setIsEditing(false);
        setIsEditWindowOpen(true);
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : 'Unable to submit feedback',
        );
      } finally {
        if (options?.savingComment) {
          setIsCommentSaving(false);
        } else {
          setIsSubmitting(false);
        }
      }
    },
    [
      activity.ids.orgId,
      canSubmit,
      currentProfileId,
      hasMessage,
      hasSource,
      metadata.channelId,
      metadata.classSessionId,
      metadata.classroomId,
      metadata.messageId,
      metadata.occurrenceStart,
      metadata.sourceEventId,
    ],
  );

  const handleSelectRating = async (value: number) => {
    if (isSubmitting || isCommentSaving || isSubmitted) {
      return;
    }

    setError(null);
    setRating(value);
    await submitFeedback(
      value,
      value < 5 ? (normalizedDraftComment ?? undefined) : undefined,
      {
        keepCommentOpen: value < 5,
      },
    );
  };

  const handleResetRating = () => {
    setIsEditing(true);
    setError(null);
  };

  useEffect(() => {
    if (!shouldShowCommentBox || !submittedAt || isSubmitting) {
      return;
    }

    if (!hasPendingCommentChanges) {
      return;
    }

    if (commentAutosaveTimerRef.current) {
      clearTimeout(commentAutosaveTimerRef.current);
    }

    commentAutosaveTimerRef.current = setTimeout(() => {
      commentAutosaveTimerRef.current = null;
      void submitFeedback(rating, normalizedDraftComment ?? undefined, {
        keepCommentOpen: true,
        savingComment: true,
      });
    }, COMMENT_AUTOSAVE_MS);

    return () => {
      if (commentAutosaveTimerRef.current) {
        clearTimeout(commentAutosaveTimerRef.current);
        commentAutosaveTimerRef.current = null;
      }
    };
  }, [
    hasPendingCommentChanges,
    isSubmitting,
    normalizedDraftComment,
    rating,
    shouldShowCommentBox,
    submitFeedback,
    submittedAt,
  ]);

  if (!metadata.feedbackUiEnabled) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.kicker}>Rate your session</Text>
        {isSubmitted && isEditWindowOpen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit rating"
            onPress={handleResetRating}
            style={styles.editButton}
          >
            <Text style={[styles.editButtonText, { color: colors.teal }]}>
              Edit rating
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Session feedback rating"
        style={styles.starRow}
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const value = index + 1;
          const isActive = value <= rating;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${value} star${value === 1 ? '' : 's'}`}
              accessibilityState={{ disabled: !canSubmit || isSubmitting || isSubmitted }}
              disabled={!canSubmit || isSubmitting || isSubmitted}
              onPress={() => void handleSelectRating(value)}
              style={({ pressed }) => [
                styles.starButton,
                { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Star
                size={16}
                color={isActive ? '#f59e0b' : colors.textMuted}
                fill={isActive ? '#f59e0b' : 'transparent'}
              />
            </Pressable>
          );
        })}
      </View>

      {shouldShowCommentBox ? (
        <View style={styles.commentWrap}>
          <TextInput
            value={comment}
            onChangeText={(value) => {
              setComment(value);
              if (error) {
                setError(null);
              }
            }}
            placeholder="Tell us what could be better..."
            placeholderTextColor={colors.textFaint}
            multiline
            style={[
              styles.commentInput,
              {
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                color: colors.text,
              },
            ]}
          />
          <Text style={[styles.supportText, { color: colors.textMuted }]}>
            {isCommentSaving
              ? 'Saving comment...'
              : hasPendingCommentChanges
                ? 'Saving shortly...'
                : 'Rating saved. Comments save automatically.'}
          </Text>
        </View>
      ) : null}

      {isSubmitted ? (
        <View style={[styles.submittedCard, { backgroundColor: colors.inputBg }]}>
          <Text style={[styles.submittedTitle, { color: colors.text }]}>
            Thank you for your feedback.
          </Text>
        </View>
      ) : null}

      {!isSubmitted && !canSubmit ? (
        <Text style={[styles.supportText, { color: colors.textMuted }]}>
          Feedback is unavailable for this session.
        </Text>
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
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    kicker: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    editButton: {
      paddingVertical: 2,
    },
    editButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    starRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    starButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    commentWrap: {
      gap: 8,
    },
    commentInput: {
      minHeight: 112,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      lineHeight: 19,
      textAlignVertical: 'top',
    },
    submittedCard: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    submittedTitle: {
      fontSize: 13,
      fontWeight: '700',
    },
    supportText: {
      fontSize: 12,
      lineHeight: 18,
    },
    errorText: {
      fontSize: 12,
      lineHeight: 18,
      color: '#dc2626',
    },
  });
}
