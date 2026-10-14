import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Angry, Frown, Laugh, Meh, Smile } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** Web's post-session rating: pick one, then Submit or Skip. */
const RATINGS = [
  { rating: 1, label: 'Terrible', Icon: Angry },
  { rating: 2, label: 'Poor', Icon: Frown },
  { rating: 3, label: 'Okay', Icon: Meh },
  { rating: 4, label: 'Good', Icon: Smile },
  { rating: 5, label: 'Great', Icon: Laugh },
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
        minHeight: 44,
        paddingHorizontal: 20,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        backgroundColor: primary ? colors.action : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {primary && submitting && <ActivityIndicator color={colors.actionForeground} />}
      <Text style={{ color: primary ? colors.actionForeground : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View
      style={{
        gap: 24,
        padding: 24,
        borderRadius: 24,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ gap: 6, alignItems: 'center' }}>
        {title && <Text style={{ color: colors.textMuted }}>{title}</Text>}
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600' }}>
          How was your session?
        </Text>
        <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
          Your feedback helps us improve future sessions.
        </Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Session rating"
        style={{ flexDirection: 'row', gap: 4 }}
      >
        {RATINGS.map(({ rating: value, label, Icon }) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: rating === value }}
            onPress={() => setRating(value)}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 6,
              paddingVertical: 12,
              borderRadius: 16,
              backgroundColor: rating === value ? colors.actionSubtle : 'transparent',
            }}
          >
            <Icon
              size={28}
              color={rating === value ? colors.primary : colors.textMuted}
            />
            <Text
              style={{
                color: rating === value ? colors.text : colors.textMuted,
                fontSize: 12,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
        {action('Skip', onSkip, false, submitting)}
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
      </View>
      {children}
    </View>
  );
}
