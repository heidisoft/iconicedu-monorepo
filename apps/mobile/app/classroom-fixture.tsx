import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, NativeModules, Text } from 'react-native';
const Fixture = lazy(() => import('@/components/classroom/classroom-fixture'));
export default function ClassroomFixtureRoute() {
  if (!__DEV__ || !NativeModules.RNZoomVideoSdk) return <Text>Not available</Text>;
  return (
    <Suspense fallback={<ActivityIndicator />}>
      <Fixture />
    </Suspense>
  );
}
