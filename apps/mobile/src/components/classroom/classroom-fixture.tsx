import { prepareClassroomFixture } from './fixture-developer-tools';
import { createNativePictureInPicture } from '@/lib/classroom/native-picture-in-picture';
import { Platform } from 'react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useZoom } from '@zoom/react-native-videosdk';
import { NativeClassroom } from '@/components/classroom/native-classroom';
import type {
  NativeMeetingAdapter,
  NativeMeetingEvent,
  NativeParticipant,
  NativeShareMode,
} from '@/lib/classroom/meeting-controller';
import type { NativeWhiteboardRepository } from '@/components/classroom/native-whiteboard';
import type { classroomApi } from '@/lib/classroom/api';
import type { WhiteboardSnapshotVM } from '@iconicedu/shared-types';

/** Deterministic native UI coverage; never a substitute for the live SDK suite. */
export function createClassroomFixtureAdapter(
  role = 'teacher',
  failure?: string,
): NativeMeetingAdapter & { peerShare(active: boolean): void } {
  let cameraId = 'front',
    audioId = 'speaker';
  let shareMode: NativeShareMode = 'single';
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
    peerShare(active) {
      send({ type: 'share', userId: '2', active });
    },
    pictureInPicture:
      Platform.OS === 'android' ? createNativePictureInPicture() : undefined,
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
      send({ type: 'left', reason: 'self' });
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
      send({ type: 'share', userId: '1', active: enabled });
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
      send({ type: 'recording', status: active ? 'recording' : 'stopped' });
    },
    async pauseRecording() {
      send({ type: 'recording', status: 'paused' });
    },
    async resumeRecording() {
      send({ type: 'recording', status: 'recording' });
    },
    async shareMode() {
      return shareMode;
    },
    async setShareMode(mode) {
      shareMode = mode;
    },
    async chat(text) {
      send({
        type: 'chat',
        id: String(Date.now()),
        sender: 'Test teacher',
        text,
        self: true,
        sentAt: Date.now(),
      });
    },
    async command(command) {
      if (command.type === 'raise-hand')
        send({ type: 'hand', userId: '1', raised: command.raised });
    },
    async devices() {
      return {
        cameras: [
          { id: 'front', label: 'Front camera', selected: cameraId === 'front' },
          { id: 'back', label: 'Back camera', selected: cameraId === 'back' },
        ],
        audio: [
          { id: 'speaker', label: 'Speaker', selected: audioId === 'speaker' },
          { id: 'headset', label: 'Test headset', selected: audioId === 'headset' },
        ],
        mirrored: false,
      };
    },
    async selectCamera(id) {
      cameraId = id;
    },
    async selectAudioRoute(id) {
      audioId = id;
    },
    async captions() {},
    async speaker() {},
    async background() {},
    async originalAudio() {},
    async stopAudioTests() {},
    async testMicrophone() {},
    async testSpeaker() {},
  };
}

function Fixture() {
  const {
    role = 'teacher',
    failure,
    scenario,
  } = useLocalSearchParams<{
    role?: string;
    failure?: string;
    scenario?: string;
  }>();
  const { getSdkVersion } = useZoom();
  const [sdkVersion, setSdkVersion] = useState('Loading');
  useEffect(() => {
    void prepareClassroomFixture()
      .then(() => getSdkVersion())
      .then(setSdkVersion)
      .catch(() => setSdkVersion('Unavailable'));
  }, [getSdkVersion]);
  const adapter = useMemo(
    () => createClassroomFixtureAdapter(role, failure),
    [role, failure],
  );
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
      actorId: 'fixture-presenter',
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
        if (failure === 'whiteboard-save' && op.type === 'elements')
          throw new Error('Synthetic save failure');
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
        if (op.type === 'presentation') {
          snapshot.presentationActive = op.enabled;
          snapshot.document.presenting = op.enabled;
          snapshot.document.presentation = op.enabled
            ? {
                presenterId: 'fixture-presenter',
                sessionId: 'fixture-session',
                presentationId: op.id,
              }
            : undefined;
        }
        if (op.type === 'clear-page') snapshot.document.pages[0].elements = [];
        return snapshot;
      },
    };
  }, [role, failure]);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text testID="native-sdk-version">Native SDK {sdkVersion}</Text>
      <NativeClassroom
        key={`${role}:${failure}:${scenario}`}
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
      {scenario === 'presentation-transition' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fixture remote whiteboard stop"
            style={{ padding: 8, minHeight: 44 }}
            onPress={() => {
              void repository.save({
                id: `remote-stop-${Date.now()}`,
                type: 'presentation',
                enabled: false,
              });
            }}
          >
            <Text>Stop peer board</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fixture start peer screen share"
            style={{ padding: 8, minHeight: 44 }}
            onPress={() => adapter.peerShare(true)}
          >
            <Text>Start peer share</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fixture stop peer screen share"
            style={{ padding: 8, minHeight: 44 }}
            onPress={() => adapter.peerShare(false)}
          >
            <Text>Stop peer share</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
export default function ClassroomFixtureRoute() {
  if (!__DEV__) return <Text>Not available</Text>;
  return <Fixture />;
}
