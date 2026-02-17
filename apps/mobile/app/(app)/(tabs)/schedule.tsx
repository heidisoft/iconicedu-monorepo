import React from 'react';
import { Typography, EmptyState, StyledView } from '@iconicedu/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledText } from '@iconicedu/ui-native';

export default function ScheduleScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <StyledView className="border-b border-slate-800 px-4 pb-3 pt-2">
        <Typography variant="h3">Schedule</Typography>
      </StyledView>
      <EmptyState
        icon={<StyledText className="text-4xl">📅</StyledText>}
        title="No upcoming classes"
        description="Your class schedule will appear here when sessions are booked."
      />
    </SafeAreaView>
  );
}
