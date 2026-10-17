import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, Text } from 'react-native';
const Fixture = lazy(() => import('@/components/classroom/annotation-sync-fixture'));
export default function AnnotationSyncFixtureRoute() {
  if (!__DEV__) return <Text>Not available</Text>;
  return (
    <Suspense fallback={<ActivityIndicator />}>
      <Fixture />
    </Suspense>
  );
}
