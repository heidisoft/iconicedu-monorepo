import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
export default function ClassroomLinkError() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: colors.bg }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22 }}>
        Unable to open classroom
      </Text>
      <Text style={{ color: colors.text }}>
        Open the invitation again to retry, or request a new link from your teacher.
      </Text>
    </View>
  );
}
