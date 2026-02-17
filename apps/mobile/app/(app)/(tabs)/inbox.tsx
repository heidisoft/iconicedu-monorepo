import React from 'react';
import { Typography, EmptyState, StyledView, StyledText } from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InboxScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <StyledView className="border-b border-slate-800 px-4 pb-3 pt-2">
        <Typography variant="h3">Inbox</Typography>
      </StyledView>
      <EmptyState
        icon={<StyledText className="text-4xl">📥</StyledText>}
        title="All caught up"
        description="Your notifications and activity feed will appear here."
      />
    </SafeAreaView>
  );
}
