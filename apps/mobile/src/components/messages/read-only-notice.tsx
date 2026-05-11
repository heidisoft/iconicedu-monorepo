import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';

export function ReadOnlyNotice() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 12) },
        { backgroundColor: colors.inputBg, borderTopColor: colors.border },
      ]}
    >
      <Text style={[styles.label, { color: colors.textMuted }]}>
        Read-only supervised conversation
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
});
