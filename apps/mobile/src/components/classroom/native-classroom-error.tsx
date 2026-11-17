import React from 'react';
import { Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** A consistent, announced error card for preview and in-call failures. */
export function NativeClassroomError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessible
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.red,
        backgroundColor: colors.card,
      }}
    >
      <TriangleAlert size={20} color={colors.red} accessibilityElementsHidden />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.red, fontWeight: '600', fontSize: 14 }}>
          Something went wrong
        </Text>
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
          {message}
        </Text>
      </View>
    </View>
  );
}
