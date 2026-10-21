import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, Text } from 'react-native';
const Fixture = lazy(() => import('@/components/classroom/whiteboard-sync-fixture'));
export default function WhiteboardSyncFixtureRoute() {
  if (!__DEV__) return <Text>Not available</Text>;
  return (
    <Suspense fallback={<ActivityIndicator />}>
      <Fixture />
    </Suspense>
  );
}
