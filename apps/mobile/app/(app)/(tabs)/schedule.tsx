import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Typography, EmptyState, NAV_THEME } from '@iconicedu/ui-native';
import { CalendarDays } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createHeaderSurface } from '@/lib/header-surface';

export default function ScheduleScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: NAV_THEME.dark.background }}
      edges={['top']}
    >
      <View style={s.header}>
        <Typography variant="h3">Schedule</Typography>
      </View>
      <EmptyState
        icon={<CalendarDays size={32} color={NAV_THEME.dark.primary} />}
        title="No upcoming classes"
        description="Your class schedule will appear here when sessions are booked."
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    ...createHeaderSurface(NAV_THEME.dark.background, '#38383A'),
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
});
