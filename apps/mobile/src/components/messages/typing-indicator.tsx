import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { SPACING, typography } from '@/lib/typography';

type TypingIndicatorProps = {
  typingUsers: string[];
};

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingUsers }) => {
  const { colors } = useTheme();

  if (typingUsers.length === 0) return null;

  const label =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing…`
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
        : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing…`;

  return (
    <View style={{ paddingHorizontal: SPACING[4], paddingVertical: SPACING[1] }}>
      <Text style={[typography.meta, { fontStyle: 'italic', color: colors.textFaint }]}>
        {label}
      </Text>
    </View>
  );
};
