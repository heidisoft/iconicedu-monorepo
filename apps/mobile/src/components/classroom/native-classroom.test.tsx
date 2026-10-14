import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { NativeClassroom } from './native-classroom';
import type {
  NativeMeetingAdapter,
  NativeMeetingEvent,
  NativeParticipant,
} from '@/lib/classroom/meeting-controller';

jest.mock('@zoom/react-native-videosdk', () => ({
  EventType: new Proxy({}, { get: (_target, key) => key }),
  WhiteboardView: () => null,
  useZoom: () => ({
    addListener: () => ({ remove: () => {} }),
    isInSession: async () => false,
    audioHelper: { resetAudioSession: async () => {} },
    whiteboardHelper: {
      isOtherSharingWhiteboard: async () => false,
      canStopShareWhiteboard: async () => false,
    },
  }),
}));
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [
    { granted: true },
    async () => ({ granted: true }),
    async () => ({ granted: true }),
  ],
  useMicrophonePermissions: () => [
    { granted: true },
    async () => ({ granted: true }),
    async () => ({ granted: true }),
  ],
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: { bg: 'white', text: 'black', card: 'white', actionSubtle: 'grey' },
  }),
}));
jest.mock('./use-native-picture-in-picture', () => ({
  useNativePictureInPicture: () => ({
    supported: false,
    automatic: false,
    active: false,
    ready: false,
    target: null,
    error: null,
    enter: async () => {},
    changeAutomatic: async () => {},
  }),
}));
jest.mock('./use-native-media-devices', () => ({
  useNativeMediaDevices: () => ({
    devices: { cameras: [], audio: [], mirrored: false },
    error: null,
    refresh: async () => {},
    select: async () => {},
  }),
}));
jest.mock('./native-video-view', () => ({ NativeVideoView: () => null }));
jest.mock('./native-share-stage', () => ({
  NativeShareStage: ({ userId }: { userId: string }) => {
    const { Text } = require('react-native');
    return <Text testID="share-stage">{userId}</Text>;
  },
}));
jest.mock('./native-focused-video', () => ({ NativeFocusedVideo: () => null }));
jest.mock('./native-whiteboard', () => ({ NativeWhiteboard: () => null }));

const teacher: NativeParticipant = {
  id: '1',
  name: 'Teacher',
  host: true,
  cohost: false,
  muted: true,
  video: false,
};
const student: NativeParticipant = { ...teacher, id: '2', name: 'Student', host: false };
const meetingApi = {
  waiting: jest.fn().mockResolvedValue([]),
  admit: jest.fn(),
  audit: jest.fn().mockResolvedValue(undefined),
  quality: jest.fn().mockResolvedValue(undefined),
  feedback: jest.fn().mockResolvedValue(undefined),
};

function setup(selfId = '2') {
  let emit: (event: NativeMeetingEvent) => void = () => {};
  const resolved = () => jest.fn().mockResolvedValue(undefined);
  const adapter: jest.Mocked<NativeMeetingAdapter> = {
    subscribe: jest.fn((listener) => {
      emit = listener;
      return () => {};
    }),
    join: jest.fn(async () => {
      emit({ type: 'joined', selfId, participants: [teacher, student] });
    }),
    leave: resolved(),
    microphone: resolved(),
    camera: resolved(),
    switchCamera: resolved(),
    share: resolved(),
    cohost: resolved(),
    host: resolved(),
    claimHost: resolved(),
    command: resolved(),
    captions: resolved(),
    recording: resolved(),
    resumeRecording: resolved(),
    recordingConsent: resolved(),
    chatPrivilege: resolved(),
    shareMode: jest.fn().mockResolvedValue('single'),
    setShareMode: resolved(),
    chat: resolved(),
    speaker: resolved(),
    testSpeaker: resolved(),
    testMicrophone: resolved(),
    stopAudioTests: resolved(),
    background: resolved(),
    originalAudio: resolved(),
  };
  const screen = render(
    <NativeClassroom
      sessionId="session-1"
      title="Algebra revision"
      adapterOverride={adapter}
      meetingApi={meetingApi}
      credentials={{
        token: 'synthetic',
        sessionName: 'zoom-session-key',
        displayName: selfId === '1' ? 'Teacher' : 'Student',
        expiresAt: null,
        settings: DEFAULT_LIVE_SESSION_SETTINGS,
      }}
    />,
  );
  const join = async () => {
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Join now'));
    });
    await waitFor(() => expect(screen.getByText('Algebra revision')).toBeTruthy());
  };
  return {
    screen,
    adapter,
    join,
    emit: (event: NativeMeetingEvent) => act(() => emit(event)),
  };
}

describe('native classroom parity with web meeting behaviour', () => {
  it('shows the class title, not the Zoom session key', async () => {
    const f = setup();
    await f.join();
    expect(f.screen.queryByText('zoom-session-key')).toBeNull();
  });
  it('asks for traditional recording consent and leaves on decline', async () => {
    const f = setup();
    await f.join();
    f.emit({ type: 'recording', status: 'recording' });
    f.emit({ type: 'recording-consent', consent: 'traditional' });
    expect(f.screen.getByText(/This class is being recorded/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(f.screen.getByLabelText('Leave class'));
    });
    expect(f.adapter.recordingConsent).toHaveBeenCalledWith(false);
    expect(f.adapter.leave).toHaveBeenCalledWith(false);
  });
  it('explains that the host ended the class', async () => {
    const f = setup();
    await f.join();
    f.emit({ type: 'left', reason: 'ended-by-host' });
    expect(f.screen.getByText('The host ended the class')).toBeTruthy();
  });
  it('lets viewers switch between simultaneous presenters', async () => {
    const f = setup('1');
    await f.join();
    f.emit({ type: 'share', userId: '2', active: true });
    f.emit({ type: 'share', userId: '1', active: true });
    expect(f.screen.getByText('You are sharing your screen')).toBeTruthy();
    fireEvent.press(f.screen.getByLabelText("View Student's screen"));
    expect(f.screen.getByTestId('share-stage')).toHaveTextContent('2');
    expect(f.screen.getByLabelText('Stop sharing screen')).toBeTruthy();
  });
  it('offers resume for a paused recording and the web share choices to the host', async () => {
    const f = setup('1');
    await f.join();
    f.emit({ type: 'recording', status: 'paused' });
    expect(f.screen.getByText('❚❚ Recording paused')).toBeTruthy();
    fireEvent.press(f.screen.getByLabelText('More controls'));
    await act(async () => {
      fireEvent.press(f.screen.getByLabelText('Resume recording'));
    });
    expect(f.adapter.resumeRecording).toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(
        f.screen.getByLabelText('Multiple participants can share simultaneously'),
      );
    });
    expect(f.adapter.setShareMode).toHaveBeenCalledWith('multiple');
  });
  it('hides the composer when the host turns chat off', async () => {
    const f = setup();
    await f.join();
    fireEvent.press(f.screen.getByLabelText('Messages'));
    expect(f.screen.getByLabelText('Message')).toBeTruthy();
    f.emit({ type: 'chat-privilege', allowed: false });
    expect(f.screen.queryByLabelText('Message')).toBeNull();
    expect(f.screen.getByText('The host has turned off chat.')).toBeTruthy();
  });
  it('offers Settings when the OS blocks the microphone mid-class', async () => {
    const f = setup();
    await f.join();
    const openSettings = jest
      .spyOn(require('react-native').Linking, 'openSettings')
      .mockResolvedValue(undefined);
    f.emit({ type: 'permission', device: 'microphone' });
    expect(f.screen.getByText(/Microphone access is blocked/)).toBeTruthy();
    fireEvent.press(f.screen.getByLabelText('Open Settings'));
    expect(openSettings).toHaveBeenCalled();
  });
  it('reports connection problems with the same levels as web, once per change', async () => {
    const f = setup();
    await f.join();
    meetingApi.quality.mockClear();
    f.emit({ type: 'network', level: 'normal' });
    f.emit({ type: 'network', level: 'bad' });
    f.emit({ type: 'network', level: 'normal' });
    f.emit({ type: 'network', level: 'bad' });
    f.emit({ type: 'connection', reconnecting: true });
    expect(meetingApi.quality.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      ['network_quality', 'bad'],
      ['connection_state', 'reconnecting'],
    ]);
    expect(f.screen.getByText(/connection is unstable/)).toBeTruthy();
  });
});
