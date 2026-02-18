import React from 'react';
import { View, Text } from 'react-native';
import { Typography, EmptyState, NAV_THEME } from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InboxScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV_THEME.dark.background }}>
      <View className="border-b border-border px-4 pb-3 pt-2">
        <Typography variant="h3">Inbox</Typography>
      </View>
      <EmptyState
        icon={<Text className="text-4xl">📥</Text>}
        title="All caught up"
        description="Your notifications and activity feed will appear here."
      />
    </SafeAreaView>
  );
}
