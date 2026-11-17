import { prepareClassroomFixture } from './fixture-developer-tools';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { publicApiGet } from '@/lib/api/http-client';
import { NativeScreenAnnotations } from './native-screen-annotations';
/** Real local API transport and native SVG gestures; no Zoom media is simulated here. */
export default function AnnotationSyncFixture() {
  const { run = '' } = useLocalSearchParams<{ run?: string }>();
  const [active, setActive] = useState(true);
  const { width, height } = useWindowDimensions();
  const [entry, setEntry] = useState<{
    run: string;
    sessionId: string;
    token: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void prepareClassroomFixture()
      .then(() =>
        publicApiGet<{ sessionId: string; token: string }>('/__annotation-entry'),
      )
      .then((value) => {
        if (active) setEntry({ ...value, run });
      });
    return () => {
      active = false;
    };
  }, [run]);
  if (!entry || entry.run !== run)
    return <ActivityIndicator accessibilityLabel="Loading local annotation test" />;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text accessibilityRole="header">Native annotation sync</Text>
      <View
        style={{
          margin: 16,
          width: width - 32,
          height: height * 0.6,
          backgroundColor: '#ffffff',
        }}
      >
        <NativeScreenAnnotations
          key={run}
          sessionId={entry.sessionId}
          shareKey="123"
          token={entry.token}
          width={width - 32}
          height={height * 0.6}
          active={active}
          onToggle={() => setActive((value) => !value)}
        />
      </View>
    </SafeAreaView>
  );
}
