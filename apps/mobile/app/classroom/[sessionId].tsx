import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, NativeModules, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { openLiveSession } from '@/lib/messages/open-live-session';
import { useTheme } from '@/providers/theme-provider';
const Entry = lazy(() =>
  import('@/components/classroom/native-classroom-entry').then((module) => ({
    default: module.NativeClassroomEntry,
  })),
);
export default function ClassroomRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors } = useTheme();
  if (!NativeModules.RNZoomVideoSdk)
    return (
      <View style={{ padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ color: colors.text }}>
          Update the app to use native classrooms, or join in your browser.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void openLiveSession(`/live/${encodeURIComponent(sessionId)}`);
          }}
          style={{ padding: 16 }}
        >
          <Text style={{ color: colors.text }}>Open classroom in browser</Text>
        </Pressable>
      </View>
    );
  return (
    <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading classroom" />}>
      <Entry key={sessionId} sessionId={sessionId} />
    </Suspense>
  );
}
