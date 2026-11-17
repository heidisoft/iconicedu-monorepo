import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** Match the centered title and chevron navigation used by native settings pages. */
export function NativeClassroomHeader({
  onBack,
  disabled = false,
}: {
  onBack: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        disabled={disabled}
        onPress={onBack}
        hitSlop={8}
        style={{
          minWidth: 44,
          minHeight: 44,
          padding: 8,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <ChevronLeft size={24} color={colors.text} />
      </Pressable>
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          fontSize: 19,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
          marginRight: 44,
        }}
      >
        Ready to join?
      </Text>
    </View>
  );
}
