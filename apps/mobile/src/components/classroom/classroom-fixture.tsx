import React, { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useZoom } from '@zoom/react-native-videosdk';
import { NativeClassroom } from '@/components/classroom/native-classroom';
import type {
  NativeMeetingAdapter,
  NativeMeetingEvent,
  NativeParticipant,
} from '@/lib/classroom/meeting-controller';
import type { NativeWhiteboardRepository } from '@/components/classroom/native-whiteboard';
import type { classroomApi } from '@/lib/classroom/api';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';

/** Deterministic native UI coverage; never a substitute for the live SDK suite. */
function Fixture() {
  const { role = 'teacher', failure } = useLocalSearchParams<{
    role?: string;
    failure?: string;
  }>();
  const { getSdkVersion } = useZoom();
  const [sdkVersion, setSdkVersion] = useState('Loading');
  useEffect(() => {
    void getSdkVersion().then(setSdkVersion);
  }, [getSdkVersion]);
  const adapter = useMemo<NativeMeetingAdapter>(() => {
    let send: (event: NativeMeetingEvent) => void = () => {};
    const users: NativeParticipant[] = [
      {
        id: '1',
        name: 'Test teacher',
        host: role === 'teacher',
        cohost: false,
        muted: true,
        video: false,
      },
      {
        id: '2',
        name: 'Test student',
        host: role !== 'teacher',
        cohost: false,
        muted: true,
        video: false,
      },
    ];
    return {
      subscribe: (listener) => {
        send = listener;
        return () => {
          send = () => {};
        };
      },
      async join() {
        if (failure === 'join') throw new Error('synthetic network failure');
        send({ type: 'joined', selfId: '1', participants: [...users] });
      },
      async leave() {
        send({ type: 'left', reason: 'BySelf' });
      },
      async microphone(id, enabled) {
        const user = users.find((item) => item.id === id);
        if (user) user.muted = !enabled;
        send({ type: 'participants', participants: users.map((item) => ({ ...item })) });
      },
      async camera(enabled) {
        users[0].video = enabled;
      },
      async switchCamera() {},
      async share(enabled) {
        send({ type: 'share', userId: enabled ? '1' : null });
      },
      async cohost(id, enabled) {
        const user = users.find((item) => item.id === id);
        if (user) user.cohost = enabled;
        send({ type: 'participants', participants: users.map((item) => ({ ...item })) });
      },
      async host(id) {
        users.forEach((user) => {
          user.host = user.id === id;
        });
        send({ type: 'participants', participants: users.map((item) => ({ ...item })) });
      },
      async claimHost() {
        users.forEach((user) => {
          user.host = user.id === '1';
        });
        send({ type: 'participants', participants: users.map((item) => ({ ...item })) });
      },
      async recording(active) {
        send({ type: 'recording', active });
      },
      async chat(text) {
        send({ type: 'chat', id: String(Date.now()), sender: 'Test teacher', text });
      },
      async command(command) {
        if (command.type === 'raise-hand')
          send({ type: 'hand', userId: '1', raised: command.raised });
      },
      async captions() {},
      async speaker() {},
      async background() {},
      async originalAudio() {},
      async stopAudioTests() {},
      async testMicrophone() {},
      async testSpeaker() {},
    };
  }, [role, failure]);
  const meetingApi = useMemo<
    Pick<typeof classroomApi, 'waiting' | 'admit' | 'audit' | 'quality' | 'feedback'>
  >(() => {
    let waiting =
      role === 'teacher'
        ? [
            {
              id: '00000000-0000-4000-8000-000000000099',
              displayName: 'Waiting guest',
              createdAt: new Date().toISOString(),
            },
          ]
        : [];
    return {
      async waiting() {
        return waiting;
      },
      async admit(_id, decision) {
        waiting = waiting.filter((user) => user.id !== decision.id);
        return { success: true };
      },
      async audit() {},
      async quality() {},
      async feedback() {},
    };
  }, [role]);
  const repository = useMemo<NativeWhiteboardRepository>(() => {
    let snapshot: WhiteboardSnapshotVM = {
      id: 'fixture-board',
      revision: 0,
      role: role === 'teacher' ? 'teacher' : 'student',
      presence: [],
      document: {
        schemaVersion: 1,
        layout: 'infinite',
        studentEditing: false,
        pages: [{ id: 'fixture-page', title: 'Class board', elements: [] }],
      },
    };
    return {
      async load() {
        return snapshot;
      },
      async save(op) {
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          document: { ...snapshot.document },
        };
        if (op.type === 'elements') {
          const elements = new Map(
            snapshot.document.pages[0].elements.map((element) => [element.id, element]),
          );
          for (const element of op.elements) elements.set(element.id, element);
          snapshot.document.pages[0].elements = [...elements.values()];
        }
        if (op.type === 'student-editing') snapshot.document.studentEditing = op.enabled;
        if (op.type === 'presentation') snapshot.presentationActive = op.enabled;
        if (op.type === 'clear-page') snapshot.document.pages[0].elements = [];
        return snapshot;
      },
    };
  }, [role]);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text testID="native-sdk-version">Native SDK {sdkVersion}</Text>
      <NativeClassroom
        key={`${role}:${failure}`}
        sessionId="00000000-0000-4000-8000-000000000001"
        credentials={{
          sessionName: 'Native classroom test',
          displayName: 'Test teacher',
          token: 'synthetic-not-a-credential',
          expiresAt: null,
          settings: {
            cohosts: { enabled: true },
            recording: { enabled: true, autoStart: false, allowStop: true },
            whiteboard: { enabled: true },
            participants: { visible: true },
            messages: { visible: true, enabled: true },
            invite: { enabled: false },
          },
          whiteboard: { provider: 'excalidraw', token: 'synthetic-board' },
        }}
        hostEligible={role === 'teacher'}
        adapterOverride={adapter}
        whiteboardRepository={repository}
        meetingApi={meetingApi}
      />
    </SafeAreaView>
  );
}
export default function ClassroomFixtureRoute() {
  if (!__DEV__) return <Text>Not available</Text>;
  return <Fixture />;
}
