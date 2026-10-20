import React from 'react';
import { Alert, Modal, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { NativeClassroom } from './native-classroom';
import type { NativeWhiteboardRepository } from './native-whiteboard';
import type {
  NativeMeetingAdapter,
  NativeMeetingEvent,
  NativeParticipant,
} from '@/lib/classroom/meeting-controller';

function press(element: Parameters<typeof fireEvent.press>[0]) {
  fireEvent.press(element);
  // The native host sends onDismiss after the slide finishes on iOS.
  const { screen } = require('@testing-library/react-native');
  for (const modal of screen.UNSAFE_getAllByType(Modal)) {
    if (!modal.props.visible && modal.props.onDismiss) fireEvent(modal, 'dismiss');
  }
}
jest.mock('@zoom/react-native-videosdk', () => ({
  EventType: new Proxy({}, { get: (_target, key) => key }),
  WhiteboardView: () => null,
  useZoom: () => ({
    addListener: () => ({ remove: () => {} }),
    isInSession: async () => false,
    audioHelper: { setSDKAudioSessionEnv: async () => true },
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
const mockAnnotationSave = jest.fn().mockResolvedValue({});
const mockAnnotationLoad = jest.fn().mockResolvedValue({
  snapshot: {
    roomId: 'room',
    studentsEnabled: true,
    objects: [],
    revision: 0,
    ended: false,
    shareSessionId: 'room',
  },
  actor: { role: 'educator', userId: '1', displayName: 'Teacher' },
  pointers: [],
  lasers: [],
});
jest.mock('@/lib/classroom/annotation-api', () => ({
  nativeAnnotationApi: () => ({ load: mockAnnotationLoad, save: mockAnnotationSave }),
}));
const mockEndAnnotations = jest.fn().mockResolvedValue(undefined);
jest.mock('@iconicedu/utils', () => ({
  ...jest.requireActual('@iconicedu/utils'),
  createShareAnnotationLifecycle: () => ({
    remember: jest.fn(),
    end: mockEndAnnotations,
  }),
}));
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: (source: unknown) => ({
      downloadAsync: async () => {},
      localUri: `file:///bundle/${String(source)}.jpg`,
    }),
  },
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 64, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('./use-reduced-motion', () => ({ useReducedMotion: () => true }));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: { bg: 'white', text: 'black', card: 'white', actionSubtle: 'grey' },
  }),
}));
const mockPipAvailability = { automatic: false, ready: false, active: false };
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
    ...mockPipAvailability,
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
jest.mock('./native-focused-video', () => ({ NativeFocusedVideo: jest.fn(() => null) }));
let mockBoardPresentation: ((active: boolean) => void) | undefined;
jest.mock('./native-whiteboard', () => ({
  NativeWhiteboard: ({
    visible,
    onClose,
    onPresentation,
  }: {
    visible: boolean;
    onClose: () => void;
    onPresentation?: (active: boolean) => void;
  }) => {
    mockBoardPresentation = onPresentation;
    const { Pressable, Text } = require('react-native');
    return visible ? (
      <Pressable accessibilityLabel="Return to video" onPress={onClose}>
        <Text>Class whiteboard</Text>
      </Pressable>
    ) : null;
  },
}));

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

function setup(
  selfId = '2',
  whiteboardRepository?: NativeWhiteboardRepository,
  overrides: Partial<React.ComponentProps<typeof NativeClassroom>> = {},
) {
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
    pauseRecording: resolved(),
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
      whiteboardRepository={whiteboardRepository}
      credentials={{
        whiteboard: whiteboardRepository
          ? { provider: 'excalidraw', token: 'synthetic-board' }
          : undefined,
        token: 'synthetic',
        sessionName: 'zoom-session-key',
        displayName: selfId === '1' ? 'Teacher' : 'Student',
        expiresAt: null,
        settings: DEFAULT_LIVE_SESSION_SETTINGS,
      }}
      {...overrides}
    />,
  );
  const join = async () => {
    await act(async () => {
      press(screen.getByLabelText('Join now'));
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
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const f = setup();
    await f.join();
    f.emit({ type: 'recording', status: 'recording' });
    f.emit({ type: 'recording-consent', consent: 'traditional' });
    expect(alert).toHaveBeenCalledWith(
      'This class is being recorded',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
    expect(f.screen.queryByText('Stay and consent')).toBeNull();
    await act(async () => {
      alert.mock.calls
        .at(-1)?.[2]
        ?.find((item) => item.text === 'Leave class')
        ?.onPress?.();
    });
    alert.mockRestore();
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
    press(f.screen.getByLabelText("View Student's screen"));
    expect(f.screen.getByTestId('share-stage')).toHaveTextContent('2');
    press(f.screen.getByLabelText('More controls'));
    expect(f.screen.getByLabelText('Stop sharing screen')).toBeTruthy();
  });
  it('offers resume for a paused recording and the web share choices to the host', async () => {
    const f = setup('1');
    await f.join();
    f.emit({ type: 'recording', status: 'paused' });
    expect(f.screen.getByLabelText('Recording paused')).toBeTruthy();
    press(f.screen.getByLabelText('More controls'));
    press(f.screen.getByLabelText('Resume recording'));
    await waitFor(() => expect(f.adapter.resumeRecording).toHaveBeenCalled());
    press(f.screen.getByLabelText('More controls'));
    press(f.screen.getByLabelText('Settings'));
    press(f.screen.getByLabelText('Meeting settings tab'));
    press(f.screen.getByLabelText('Multiple participants can share simultaneously'));
    await waitFor(() => expect(f.adapter.setShareMode).toHaveBeenCalledWith('multiple'));
  });
  it('hides the composer when the host turns chat off', async () => {
    const f = setup();
    await f.join();
    press(f.screen.getByLabelText('More controls'));
    press(f.screen.getByLabelText('Messages'));
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
    press(f.screen.getByLabelText('Open Settings'));
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
  it('keeps hand raise and web reactions in a dock and shows reactions on the tile', async () => {
    const f = setup();
    await f.join();
    press(f.screen.getByLabelText('More controls'));
    press(f.screen.getByLabelText('Raise hand'));
    await waitFor(() =>
      expect(f.adapter.command).toHaveBeenCalledWith({
        type: 'raise-hand',
        raised: true,
      }),
    );
    press(f.screen.getByLabelText('Open reactions'));
    expect(
      f.screen.getAllByLabelText(/^React /).map((node) => node.props.accessibilityLabel),
    ).toEqual(['React 👍', 'React 👏', 'React 🎉', 'React ❤️', 'React 😂']);
    f.emit({ type: 'reaction', userId: '1', emoji: '🎉' });
    expect(f.screen.getByLabelText('Teacher reacted 🎉')).toBeTruthy();
  });
  it('remembers a web catalog background chosen in preview and applies it after joining', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.clear();
    const f = setup();
    await act(async () => {
      press(f.screen.getByLabelText('Settings'));
    });
    press(f.screen.getByLabelText('Video settings tab'));
    expect(f.screen.getByText(/applied when you join/)).toBeTruthy();
    await act(async () => {
      press(f.screen.getByLabelText('Background photo: Background 1'));
    });
    expect(f.adapter.background).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('classroom.background-preset.v1')).toBe(
      'image:pexels-anna-nekrashevich-8534465.jpg',
    );
    await f.join();
    await waitFor(() =>
      expect(f.adapter.background).toHaveBeenCalledWith(
        'image',
        expect.stringMatching(/^file:\/\/\/bundle\//),
      ),
    );
  });
  it('explains an interrupted call and pauses the camera while the app is in the background', async () => {
    const { AppState } = require('react-native');
    const listeners: Array<(state: string) => void> = [];
    // Restoring a spy on jest-expo's mocked AppState leaves it returning undefined,
    // so keep and reinstate the original function instead.
    const original = AppState.addEventListener;
    AppState.addEventListener = (_type: string, listener: (state: string) => void) => {
      listeners.push(listener);
      return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
    };
    try {
      const f = setup();
      await f.join();
      f.emit({ type: 'audio-interrupted', active: true });
      expect(f.screen.getByText(/paused by another call/)).toBeTruthy();
      f.emit({ type: 'audio-interrupted', active: false });
      expect(f.screen.queryByText(/paused by another call/)).toBeNull();
      await act(async () => listeners.forEach((listener) => listener('background')));
      expect(f.adapter.camera).toHaveBeenLastCalledWith(false);
      await act(async () => listeners.forEach((listener) => listener('active')));
      expect(f.adapter.camera).toHaveBeenLastCalledWith(true);
      // A camera that was already off stays off after returning.
      f.adapter.camera.mockClear();
      await act(async () => {
        press(f.screen.getByLabelText('Stop video'));
      });
      await act(async () => listeners.forEach((listener) => listener('background')));
      await act(async () => listeners.forEach((listener) => listener('active')));
      expect(f.adapter.camera.mock.calls).toEqual([[false]]);
    } finally {
      AppState.addEventListener = original;
    }
  });
  it('closes annotations when a presenter stops, not when a viewer switches presenters', async () => {
    mockEndAnnotations.mockClear();
    const f = setup('1');
    await f.join();
    f.emit({ type: 'share', userId: '2', active: true });
    f.emit({ type: 'share', userId: '1', active: true });
    press(f.screen.getByLabelText("View Student's screen"));
    expect(mockEndAnnotations).not.toHaveBeenCalled();
    f.emit({ type: 'share', userId: '2', active: false });
    expect(mockEndAnnotations).toHaveBeenCalledWith('2');
    expect(mockEndAnnotations).toHaveBeenCalledTimes(1);
  });
  it('shows the attendee count, labels your tile and can hide your self-view', async () => {
    const f = setup();
    await f.join();
    expect(f.screen.getByText('· 2 Attendees')).toBeTruthy();
    expect(f.screen.getByLabelText('Student (You) status')).toBeTruthy();
    press(f.screen.getByLabelText('More controls'));
    press(f.screen.getByLabelText('Settings'));
    press(f.screen.getByLabelText('Video settings tab'));
    fireEvent(f.screen.getByLabelText('Show self-view'), 'valueChange', false);
    expect(f.screen.queryByLabelText('Focus Student')).toBeNull();
    expect(f.screen.getByLabelText('Focus Teacher')).toBeTruthy();
  });
  it('uses web leave wording for students, a lone host and a host with a student', async () => {
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const student = setup();
      await student.join();
      press(student.screen.getByLabelText('Leave class'));
      expect(alert.mock.calls.at(-1)?.[0]).toBe('Leave the class?');
      student.screen.unmount();

      const host = setup('1');
      await host.join();
      press(host.screen.getByLabelText('Leave or end class'));
      expect(alert.mock.calls.at(-1)?.[0]).toBe('Leave or end the class?');
      const shown = alert.mock.calls.length;
      press(host.screen.getByLabelText('Leave or end class'));
      expect(alert).toHaveBeenCalledTimes(shown);
      const buttons = alert.mock.calls.at(-1)?.[2] as Array<{
        text: string;
        onPress?: () => void;
      }>;
      expect(buttons.map((button) => button.text)).toEqual([
        'Cancel',
        'Leave',
        'End for everyone',
      ]);
      await act(async () => buttons[2].onPress?.());
      expect(host.adapter.leave).toHaveBeenCalledWith(true);
      expect(meetingApi.audit).toHaveBeenCalledWith('session-1', 'end_session_for_all');
    } finally {
      alert.mockRestore();
    }
  });
  it('offers End class to a host who is alone', async () => {
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const f = setup('1');
      f.adapter.join.mockImplementation(async () => {});
      await act(async () => {
        press(f.screen.getByLabelText('Join now'));
      });
      f.emit({ type: 'joined', selfId: '1', participants: [teacher] });
      press(f.screen.getByLabelText('End class'));
      expect(alert.mock.calls.at(-1)?.[0]).toBe('End the class?');
    } finally {
      alert.mockRestore();
    }
  });
  it('opens chat as a sheet with You, relative times and an empty state', async () => {
    const f = setup();
    await f.join();
    press(f.screen.getByLabelText('More controls'));
    press(f.screen.getByLabelText('Messages'));
    expect(f.screen.getByText('In-call Messages')).toBeTruthy();
    expect(f.screen.getByText('No messages yet.')).toBeTruthy();
    f.emit({
      type: 'chat',
      id: 'm1',
      sender: 'Student',
      text: 'Can you explain step 2?',
      self: true,
      sentAt: Date.now() - 5 * 60_000,
    });
    expect(f.screen.getByText('You')).toBeTruthy();
    expect(f.screen.getByText('5 min ago')).toBeTruthy();
    fireEvent.changeText(f.screen.getByLabelText('Message'), 'Thanks');
    await act(async () => {
      press(f.screen.getByLabelText('Send message'));
    });
    expect(f.adapter.chat).toHaveBeenCalledWith('Thanks');
  });
  it('asks for a labelled rating with Submit and Skip after the lesson', async () => {
    const { router } = require('expo-router');
    const f = setup();
    await f.join();
    f.emit({ type: 'left', reason: 'ended-by-host' });
    expect(f.screen.getByLabelText('Submit').props.accessibilityState.disabled).toBe(
      true,
    );
    press(f.screen.getByLabelText('Great'));
    await act(async () => {
      press(f.screen.getByLabelText('Submit'));
    });
    expect(meetingApi.feedback).toHaveBeenCalledWith('session-1', 5, 'Student');
    expect(router.back).toHaveBeenCalled();
  });
});

it('starts a shared board and returns to video without stopping the presentation', async () => {
  const repository = {
    load: jest.fn().mockResolvedValue({ presentationActive: false }),
    save: jest.fn().mockResolvedValue({}),
  };
  const f = setup('1', repository);
  await f.join();
  press(f.screen.getByLabelText('Whiteboard'));
  await waitFor(() => expect(f.screen.getByText('Class whiteboard')).toBeTruthy());
  expect(repository.save).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'presentation', enabled: true }),
  );
  press(f.screen.getByLabelText('Return to video'));
  expect(f.screen.queryByText('Class whiteboard')).toBeNull();
  expect(repository.save).toHaveBeenCalledTimes(1);
  expect(f.screen.getByLabelText('Leave or end class')).toBeTruthy();
});

it('keeps device tests in Settings and stops them when closing', async () => {
  const f = setup();
  expect(f.screen.queryByLabelText('Test audio and video')).toBeNull();
  press(f.screen.getByLabelText('Settings'));
  expect(f.screen.getByLabelText('Test microphone')).toBeTruthy();
  press(f.screen.getByLabelText('Test speakers'));
  await waitFor(() => expect(f.adapter.testSpeaker).toHaveBeenCalledWith(true));
  expect(f.screen.getByLabelText('Stop speaker test')).toBeTruthy();
  press(f.screen.getByLabelText('Close settings'));
  await waitFor(() => expect(f.adapter.stopAudioTests).toHaveBeenCalled());
  expect(f.screen.queryByLabelText('Test speakers')).toBeNull();
});
it('can close Settings even when stopping a device test fails', async () => {
  const f = setup();
  f.adapter.stopAudioTests.mockRejectedValueOnce(new Error('Unable to stop audio test'));
  press(f.screen.getByLabelText('Settings'));
  await act(async () => {
    press(f.screen.getByLabelText('Close settings'));
  });
  await waitFor(() => expect(f.screen.queryByLabelText('Close settings')).toBeNull());
  expect(f.screen.getByRole('alert')).toHaveTextContent(/Unable to stop audio test/);
});
it('shows broadcast launch errors and allows retrying Share screen', async () => {
  const f = setup();
  await f.join();
  f.adapter.share.mockRejectedValueOnce(
    new Error('Screen sharing is missing from this app build.'),
  );
  press(f.screen.getByLabelText('Share screen'));
  await waitFor(() =>
    expect(f.screen.getByRole('alert')).toHaveTextContent(/Screen sharing is missing/),
  );
  press(f.screen.getByLabelText('Share screen'));
  await waitFor(() => expect(f.adapter.share).toHaveBeenCalledTimes(2));
  expect(f.adapter.share).toHaveBeenLastCalledWith(true);
});

it('initializes annotations for the mobile host’s own screen and exposes permissions', async () => {
  const f = setup('1');
  await f.join();
  f.emit({ type: 'share', userId: '1', active: true });
  await waitFor(() => expect(mockAnnotationLoad).toHaveBeenCalled());
  await waitFor(() =>
    expect(f.screen.getByLabelText('Disable participant annotations')).toBeTruthy(),
  );
  press(f.screen.getByLabelText('Disable participant annotations'));
  await waitFor(() =>
    expect(mockAnnotationSave).toHaveBeenCalledWith(
      'room',
      expect.objectContaining({ kind: 'permissions', enabled: false }),
    ),
  );
});
it('shows recording state and lets the host pause from More', async () => {
  const f = setup('1');
  await f.join();
  f.emit({ type: 'recording', status: 'recording' });
  expect(f.screen.getByLabelText('Recording active')).toBeTruthy();
  press(f.screen.getByLabelText('More controls'));
  press(f.screen.getByLabelText('Pause recording'));
  await waitFor(() => expect(f.adapter.pauseRecording).toHaveBeenCalledTimes(1));
  f.emit({ type: 'recording', status: 'paused' });
  expect(f.screen.getByLabelText('Recording paused')).toBeTruthy();
});

it('keeps the chat draft when the SDK rejects a message', async () => {
  const f = setup();
  f.adapter.chat.mockRejectedValueOnce(new Error('offline'));
  await f.join();
  press(f.screen.getByLabelText('More controls'));
  press(f.screen.getByLabelText('Messages'));
  fireEvent.changeText(f.screen.getByLabelText('Message'), 'Retry this message');
  press(f.screen.getByLabelText('Send message'));
  await waitFor(() =>
    expect(f.screen.getByText('Message could not be sent. Try again.')).toBeTruthy(),
  );
  expect(f.screen.getByLabelText('Message').props.value).toBe('Retry this message');
});

it('removes a stopped board and displays the next screen share without leaving the call', async () => {
  const f = setup('2', { load: jest.fn(), save: jest.fn() });
  await f.join();
  act(() => mockBoardPresentation?.(true));
  expect(f.screen.getByText('Class whiteboard')).toBeTruthy();
  act(() => mockBoardPresentation?.(false));
  expect(f.screen.queryByText('Class whiteboard')).toBeNull();
  f.emit({ type: 'share', userId: '1', active: true });
  expect(f.screen.getByTestId('share-stage')).toHaveTextContent('1');
  expect(f.screen.getByLabelText('Expand shared screen to full screen')).toBeTruthy();
});
it('lets a new screen share replace a still visible board before its next poll', async () => {
  const f = setup('2', { load: jest.fn(), save: jest.fn() });
  await f.join();
  act(() => mockBoardPresentation?.(true));
  f.emit({ type: 'share', userId: '1', active: true });
  expect(f.screen.queryByText('Class whiteboard')).toBeNull();
  expect(f.screen.getByTestId('share-stage')).toHaveTextContent('1');
  act(() => mockBoardPresentation?.(false));
  expect(f.screen.getByTestId('share-stage')).toHaveTextContent('1');
});
it('places either presentation beside a vertical participant strip in landscape', async () => {
  const native = require('react-native');
  const dimensions = jest
    .spyOn(native, 'useWindowDimensions')
    .mockReturnValue({ width: 1024, height: 600, scale: 1, fontScale: 1 });
  try {
    const f = setup('2', { load: jest.fn(), save: jest.fn() });
    await f.join();
    act(() => mockBoardPresentation?.(true));
    expect(f.screen.getByTestId('presentation-landscape').props.style.flexDirection).toBe(
      'row',
    );
    expect(f.screen.getByLabelText('Meeting participants').props.horizontal).toBe(false);
    f.emit({ type: 'share', userId: '1', active: true });
    expect(f.screen.getByTestId('presentation-landscape')).toBeTruthy();
    expect(f.screen.getByLabelText('Meeting participants').props.horizontal).toBe(false);
  } finally {
    dimensions.mockRestore();
  }
});

it('closes expanded sharing when the presenter stops sharing', async () => {
  const f = setup();
  await f.join();
  f.emit({ type: 'share', userId: '1', active: true });
  press(f.screen.getByLabelText('Expand shared screen to full screen'));
  const Focused = require('./native-focused-video').NativeFocusedVideo;
  expect(f.screen.UNSAFE_getByType(Focused).props.sharing).toBe(true);
  f.emit({ type: 'share', userId: '1', active: false });
  expect(f.screen.UNSAFE_getByType(Focused).props.sharing).toBe(false);
  expect(f.screen.queryByTestId('share-stage')).toBeNull();
});
it('opens audio and video tabs from unified Settings', async () => {
  const f = setup('1');
  await f.join();
  expect(f.screen.queryByLabelText('Video settings')).toBeNull();
  expect(f.screen.queryByLabelText('Audio settings')).toBeNull();
  press(f.screen.getByLabelText('More controls'));
  press(f.screen.getByLabelText('Settings'));
  press(f.screen.getByLabelText('Video settings tab'));
  expect(
    f.screen.getByLabelText('Video settings tab').props.accessibilityState.selected,
  ).toBe(true);
  press(f.screen.getByLabelText('Audio settings tab'));
  expect(
    f.screen.getByLabelText('Audio settings tab').props.accessibilityState.selected,
  ).toBe(true);
});
it('stops the outbound share from its persistent status notice', async () => {
  const f = setup('1');
  await f.join();
  f.emit({ type: 'share', userId: '1', active: true });
  await act(async () => {});
  press(f.screen.getByLabelText('Stop screen sharing'));
  await waitFor(() => expect(f.adapter.share).toHaveBeenCalledWith(false));
});
it('turns off only the camera when using poor-connection help', async () => {
  const f = setup('1');
  await f.join();
  if (f.screen.queryByLabelText('Start video'))
    press(f.screen.getByLabelText('Start video'));
  await act(async () => {});
  const microphoneCalls = jest.mocked(f.adapter.microphone).mock.calls.length;
  f.emit({ type: 'network', level: 'bad' });
  press(f.screen.getByLabelText('Turn camera off to improve connection'));
  await waitFor(() => expect(f.adapter.camera).toHaveBeenLastCalledWith(false));
  expect(jest.mocked(f.adapter.microphone).mock.calls).toHaveLength(microphoneCalls);
});

it.each([true, false])(
  'offers local visibility and only lets the owner stop a shared board (owner %s)',
  async (owner) => {
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const repository = {
      load: jest.fn().mockResolvedValue({
        presentationActive: true,
        actorId: 'self',
        document: { presentation: { presenterId: owner ? 'self' : 'peer' } },
      }),
      save: jest.fn().mockResolvedValue({}),
    };
    const f = setup('1', repository);
    await f.join();
    press(f.screen.getByLabelText('More controls'));
    press(f.screen.getByLabelText('Whiteboard'));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Whiteboard',
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
      ),
    );
    const actions = alert.mock.calls[alert.mock.calls.length - 1][2] as {
      text: string;
      onPress?: () => void;
    }[];
    expect(actions.some((action) => action.text === 'Stop sharing for everyone')).toBe(
      owner,
    );
    expect(repository.save).not.toHaveBeenCalled();
    if (owner) {
      await act(async () =>
        actions
          .find((action) => action.text === 'Stop sharing for everyone')
          ?.onPress?.(),
      );
      await waitFor(() =>
        expect(repository.save).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'presentation', enabled: false }),
        ),
      );
    } else {
      await act(async () =>
        actions.find((action) => action.text === 'Show whiteboard')?.onPress?.(),
      );
      expect(repository.save).not.toHaveBeenCalled();
    }
    alert.mockRestore();
  },
);

it('stops device tests when leaving the Audio settings tab', async () => {
  const f = setup();
  press(f.screen.getByLabelText('Settings'));
  press(f.screen.getByLabelText('Test speakers'));
  await waitFor(() => expect(f.adapter.testSpeaker).toHaveBeenCalledWith(true));
  press(f.screen.getByLabelText('Video settings tab'));
  await waitFor(() => expect(f.adapter.stopAudioTests).toHaveBeenCalled());
  press(f.screen.getByLabelText('Audio settings tab'));
  await waitFor(() => expect(f.screen.getByLabelText('Test speakers')).toBeTruthy());
});

it('uses the full preview and Settings before a shared-device identity is authorized', async () => {
  const authorize = jest.fn().mockResolvedValue({
    token: 'synthetic-group',
    sessionName: 'Test',
    displayName: 'Student One & Student Two',
    expiresAt: null,
  });
  const f = setup('2', undefined, {
    credentials: undefined,
    previewDisplayName: 'Student One & Student Two',
    studentChoices: <Text>Who is joining?</Text>,
    authorize,
  });
  expect(f.screen.getByText('Who is joining?')).toBeTruthy();
  expect(f.screen.getByRole('header', { name: 'Ready to join?' })).toBeTruthy();
  press(f.screen.getByLabelText('Settings'));
  expect(f.screen.getByLabelText('Test speakers')).toBeTruthy();
  await act(async () => {
    press(f.screen.getByLabelText('Video settings tab'));
  });
  expect(f.screen.getByLabelText('Choose background image')).toBeTruthy();
  await act(async () => {
    press(f.screen.getByLabelText('Close settings'));
  });
  await waitFor(() => expect(f.screen.queryByLabelText('Close settings')).toBeNull());
  expect(authorize).not.toHaveBeenCalled();
  expect(f.adapter.join).not.toHaveBeenCalled();
  await f.join();
  expect(authorize).toHaveBeenCalledTimes(1);
  expect(f.adapter.join).toHaveBeenCalledWith(
    expect.objectContaining({ token: 'synthetic-group' }),
    expect.anything(),
  );
});

it('offers microphone selection and mute in Audio settings before joining', async () => {
  const f = setup();
  press(f.screen.getByLabelText('Settings'));
  expect(f.screen.getByLabelText('Microphone: System default')).toBeTruthy();
  const toggle = f.screen.getByRole('switch', { name: 'Microphone on' });
  fireEvent(toggle, 'valueChange', false);
  expect(f.screen.getByRole('switch', { name: 'Microphone on' }).props.value).toBe(false);
  expect(f.adapter.join).not.toHaveBeenCalled();
});

it.each(['1', '2'])(
  'disables screen sharing during an active board even when locally hidden (user %s)',
  async (userId) => {
    const repository = {
      load: jest.fn().mockResolvedValue({
        presentationActive: true,
        actorId: 'self',
        document: { presentation: { presenterId: 'self' } },
      }),
      save: jest.fn().mockResolvedValue({}),
    };
    const f = setup(userId, repository);
    await f.join();
    act(() => mockBoardPresentation?.(true));
    expect(f.screen.getByLabelText('Share screen')).toBeDisabled();
    press(f.screen.getByLabelText('Return to video'));
    expect(f.screen.getByLabelText('Share screen')).toBeDisabled();
    press(f.screen.getByLabelText('Share screen'));
    expect(f.adapter.share).not.toHaveBeenCalled();
    act(() => mockBoardPresentation?.(false));
    expect(f.screen.getByLabelText('Share screen')).toBeEnabled();
  },
);
it.each(['1', '2'])(
  'disables starting a whiteboard while someone shares their screen (user %s)',
  async (userId) => {
    const f = setup(userId);
    await f.join();
    f.emit({ type: 'share', userId: 'peer', active: true });
    expect(f.screen.getByLabelText('Whiteboard')).toBeDisabled();
  },
);

it('gives automatic floating-call entry time to start before pausing the background camera', async () => {
  const { AppState } = require('react-native');
  const original = AppState.addEventListener;
  const listeners: Array<(state: string) => void> = [];
  AppState.addEventListener = (_type: string, listener: (state: string) => void) => {
    listeners.push(listener);
    return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
  };
  mockPipAvailability.automatic = true;
  mockPipAvailability.ready = true;
  try {
    const f = setup();
    await f.join();
    jest.useFakeTimers();
    await act(async () => listeners.forEach((listener) => listener('background')));
    expect(f.adapter.camera).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1499);
    });
    expect(f.adapter.camera).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(f.adapter.camera).toHaveBeenLastCalledWith(false);
    await act(async () => listeners.forEach((listener) => listener('active')));
    f.adapter.camera.mockClear();
    await act(async () => listeners.forEach((listener) => listener('background')));
    mockPipAvailability.active = true;
    f.emit({ type: 'audio-interrupted', active: true });
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(f.adapter.camera).not.toHaveBeenCalled();
    jest.useRealTimers();
    f.screen.unmount();
  } finally {
    jest.useRealTimers();
    mockPipAvailability.automatic = false;
    mockPipAvailability.ready = false;
    mockPipAvailability.active = false;
    AppState.addEventListener = original;
  }
});

it('allows iPad floating calls while a saved whiteboard remains mounted', async () => {
  const pipHook = jest.spyOn(
    require('./use-native-picture-in-picture'),
    'useNativePictureInPicture',
  );
  try {
    const repository = {
      load: jest.fn().mockResolvedValue({ presentationActive: false, document: {} }),
      save: jest.fn().mockResolvedValue({}),
    };
    const f = setup('1', repository);
    await f.join();
    press(f.screen.getByLabelText('Whiteboard'));
    await waitFor(() => expect(f.screen.getByText('Class whiteboard')).toBeTruthy());
    expect(pipHook.mock.calls.at(-1)?.[3]).toBe(false);
  } finally {
    pipHook.mockRestore();
  }
});

it.each(['share', 'meeting'])(
  'closes the expanded shared screen when the %s ends',
  async (ending) => {
    const focused = require('./native-focused-video').NativeFocusedVideo;
    const f = setup('1');
    await f.join();
    f.emit({ type: 'share', userId: '2', active: true });
    press(f.screen.getByLabelText('Expand shared screen to full screen'));
    expect(focused.mock.calls.at(-1)[0].user.id).toBe('2');
    if (ending === 'share') f.emit({ type: 'share', userId: '2', active: false });
    else f.emit({ type: 'left', reason: 'ended-by-host' });
    await waitFor(() => expect(focused.mock.calls.at(-1)[0].user).toBeUndefined());
  },
);
