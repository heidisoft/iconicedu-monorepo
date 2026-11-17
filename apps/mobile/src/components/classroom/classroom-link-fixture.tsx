import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import type { PublicLiveSessionInfoVM } from '@iconicedu/shared-types';
import type { classroomApi } from '@/lib/classroom/api';
import { writeNativeMeetingLink } from '@/lib/classroom/link-recovery';
import { NativeClassroomEntry } from './native-classroom-entry';
import { createClassroomFixtureAdapter } from './classroom-fixture';

/** The real entry/preview components with synthetic API/meeting adapters, never available in release builds. */
export default function ClassroomLinkFixture() {
  const { mode = 'invited', resume } = useLocalSearchParams<{
    mode?: string;
    resume?: string;
  }>();
  const id = `fixture-link-${mode}`;
  const [ready, setReady] = useState(false);
  const state = useMemo(() => ({ approved: mode === 'member' }), [mode]);
  const adapter = useMemo(() => createClassroomFixtureAdapter('student'), []);
  const info = useMemo<PublicLiveSessionInfoVM>(
    () => ({
      exists: true,
      isActive: true,
      isHost: false,
      sessionTitle: 'Link flow test',
      sessionId: id,
      passcodeRequired: mode !== 'member',
      ...(mode === 'member' ? { participant: { displayName: 'Signed-in student' } } : {}),
    }),
    [id, mode],
  );
  const api = useMemo<typeof classroomApi>(
    () => ({
      info: async () => info,
      linkInfo: async () => ({ info, linkToken: 'synthetic-invitation-not-a-secret' }),
      join: async (_id, body) =>
        mode === 'waiting' && !state.approved
          ? { admission: { token: 'synthetic-admission', status: 'waiting' } }
          : {
              sessionName: 'Link flow test',
              displayName: body.displayNameOverride ?? body.displayName,
              token: 'synthetic-not-a-credential',
              expiresAt: null,
            },
      admission: async (_id, _token, cancel) => ({
        token: 'synthetic-admission',
        status: cancel ? 'denied' : state.approved ? 'approved' : 'waiting',
      }),
      waiting: async () => [],
      admit: async () => ({ success: true }),
      audit: async () => undefined,
      quality: async () => undefined,
      feedback: async () => undefined,
    }),
    [info, mode, state],
  );
  useEffect(() => {
    let active = true;
    setReady(false);
    const prepare =
      resume === '1'
        ? Promise.resolve()
        : writeNativeMeetingLink(id, {
            ...(mode === 'invited' ? { token: 'synthetic-invitation-not-a-secret' } : {}),
            expiresAt: Date.now() + 3600000,
          });
    void prepare.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [id, mode, resume]);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text>Native link flow fixture</Text>
      {ready ? (
        <NativeClassroomEntry
          key={`${id}:${resume}`}
          sessionId={id}
          api={api}
          meetingProps={{ adapterOverride: adapter }}
        />
      ) : (
        <ActivityIndicator />
      )}
      {mode === 'waiting' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Approve fixture guest"
          onPress={() => {
            state.approved = true;
          }}
          style={{ minHeight: 48, padding: 12 }}
        >
          <Text>Approve fixture guest</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
