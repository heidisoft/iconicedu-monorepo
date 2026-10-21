import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** Native feedback-card styling with the existing one-to-five session rating contract. */
const RATINGS = [
  { rating: 1, label: 'Terrible' },
  { rating: 2, label: 'Poor' },
  { rating: 3, label: 'Okay' },
  { rating: 4, label: 'Good' },
  { rating: 5, label: 'Great' },
] as const;

export function NativeMeetingFeedback({
  title,
  onSubmit,
  onSkip,
  children,
}: {
  title?: string;
  onSubmit: (rating: number) => Promise<void>;
  onSkip: () => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const action = (
    label: string,
    onPress: () => void,
    primary: boolean,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        backgroundColor: primary ? colors.action : 'transparent',
        borderWidth: 0,
        borderColor: colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {primary && submitting && <ActivityIndicator color={colors.actionForeground} />}
      <Text
        style={{
          color: primary ? colors.actionForeground : colors.textMuted,
          fontSize: 16,
          fontWeight: primary ? '600' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
        gap: 20,
        padding: 20,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ gap: 6 }}>
        {title && <Text style={{ color: colors.textMuted }}>{title}</Text>}
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '600' }}
        >
          How was your session?
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          Your feedback helps us improve future sessions.
        </Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Session rating"
        style={{ flexDirection: 'row', gap: 8 }}
      >
        {RATINGS.map(({ rating: value, label }) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: rating === value, disabled: submitting }}
            disabled={submitting}
            onPress={() => setRating(value)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 48,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: rating === value ? colors.action : colors.border,
              backgroundColor: rating === value ? colors.actionSubtle : 'transparent',
            }}
          >
            <Star
              size={24}
              color={
                rating !== null && value <= rating ? colors.warning : colors.textMuted
              }
              fill={rating !== null && value <= rating ? colors.warning : 'transparent'}
            />
          </Pressable>
        ))}
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}
      >
        {rating === null ? 'Select a rating' : RATINGS[rating - 1].label}
      </Text>
      <View style={{ gap: 4 }}>
        {action(
          'Submit',
          () => {
            if (rating === null) return;
            setSubmitting(true);
            void onSubmit(rating).finally(() => setSubmitting(false));
          },
          true,
          rating === null || submitting,
        )}
        {action('Skip', onSkip, false, submitting)}
      </View>
      {children}
    </View>
  );
}
