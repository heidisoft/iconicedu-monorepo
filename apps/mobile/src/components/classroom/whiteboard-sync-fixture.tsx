import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { LiveSessionJoinCredentialsVM } from '@iconicedu/shared-types';
import { publicApiGet } from '@/lib/api/http-client';
import { NativeClassroom } from './native-classroom';
import { createClassroomFixtureAdapter } from './classroom-fixture';
/** Only SDK media is synthetic. Whiteboard transport and persistence use the local apps/api. */
export default function WhiteboardSyncFixture() {
  const { role = 'student' } = useLocalSearchParams<{ role?: string }>();
  const [entry, setEntry] = useState<{
    sessionId: string;
    credentials: LiveSessionJoinCredentialsVM;
  } | null>(null);
  const adapter = useMemo(
    () => createClassroomFixtureAdapter(role === 'teacher' ? 'teacher' : 'student'),
    [role],
  );
  useEffect(() => {
    let active = true;
    void publicApiGet<{ sessionId: string; credentials: LiveSessionJoinCredentialsVM }>(
      `/__whiteboard-entry?role=${encodeURIComponent(role)}`,
    ).then((value) => {
      if (active) setEntry(value);
    });
    return () => {
      active = false;
    };
  }, [role]);
  if (!entry)
    return <ActivityIndicator accessibilityLabel="Loading local whiteboard test" />;
  return (
    <NativeClassroom
      key={role}
      sessionId={entry.sessionId}
      credentials={entry.credentials}
      adapterOverride={adapter}
      meetingApi={{
        waiting: async () => [],
        admit: async () => ({ success: true }),
        audit: async () => undefined,
        quality: async () => undefined,
        feedback: async () => undefined,
      }}
    />
  );
}
