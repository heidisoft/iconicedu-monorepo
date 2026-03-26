import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { EmptyState } from '@iconicedu/ui-native';
import { CalendarDays } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createHeaderSurface } from '@/lib/header-surface';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    header: {
      ...createHeaderSurface(C.pageBg, C.border),
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.5,
    },
  });
}

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Schedule</Text>
      </View>
      <EmptyState
        icon={<CalendarDays size={32} color={colors.teal} />}
        title="No upcoming classes"
        description="Your class schedule will appear here when sessions are booked."
      />
    </SafeAreaView>
  );
}
