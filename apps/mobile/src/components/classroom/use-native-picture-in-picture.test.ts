import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  pictureInPictureTarget,
  useNativePictureInPicture,
} from './use-native-picture-in-picture';
import type { NativeMeetingState } from '@/lib/classroom/meeting-controller';
import type { NativePictureInPictureAdapter } from '@/lib/classroom/native-picture-in-picture';
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
const meeting: NativeMeetingState = {
  phase: 'meeting',
  selfId: '1',
  participants: [
    { id: '1', name: 'Teacher', host: true, cohost: false, muted: false, video: true },
    { id: '2', name: 'Student', host: false, cohost: false, muted: true, video: true },
  ],
  speaking: [],
  microphone: true,
  camera: true,
  sharingUserId: null,
  recording: false,
  error: null,
  composited: [],
  network: null,
  raisedHands: [],
  reactions: [],
  caption: '',
  messages: [],
};
function adapter() {
  return {
    supported: jest.fn().mockResolvedValue(true),
    configure: jest.fn().mockResolvedValue(undefined),
    enter: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(() => jest.fn()),
  };
}
it('prefers remote screen sharing, then focused video, and removes departed participants', () => {
  expect(pictureInPictureTarget({ ...meeting, sharingUserId: '2' }, '1')).toMatchObject({
    user: { id: '2' },
    sharing: true,
  });
  expect(
    pictureInPictureTarget({
      ...meeting,
      speaking: ['3'],
      participants: [...meeting.participants, { ...meeting.participants[1], id: '3' }],
    }),
  ).toMatchObject({ user: { id: '3' } });
  expect(pictureInPictureTarget(meeting, '1')).toMatchObject({
    user: { id: '1' },
    sharing: false,
  });
  expect(
    pictureInPictureTarget({ ...meeting, participants: [meeting.participants[0]] }, '2'),
  ).toMatchObject({ user: { id: '1' } });
});
it('serializes delayed configuration before disabling PiP after leaving', async () => {
  let finish!: () => void;
  const pip = adapter();
  pip.configure.mockImplementation((id: string) =>
    id
      ? new Promise<void>((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(),
  );
  const { result, rerender, unmount } = renderHook(
    ({ state }) => useNativePictureInPicture(pip as NativePictureInPictureAdapter, state),
    { initialProps: { state: meeting } },
  );
  await waitFor(() => expect(pip.configure).toHaveBeenCalledWith('2', false, false));
  rerender({ state: { ...meeting, phase: 'ended' } });
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(pip.configure).toHaveBeenCalledWith('', false, false));
  expect(result.current.ready).toBe(false);
  unmount();
});
it('disables automatic and manual PiP while whiteboard editing blocks transitions', async () => {
  const pip = adapter();
  const { result, unmount } = renderHook(() =>
    useNativePictureInPicture(pip, meeting, undefined, true),
  );
  await waitFor(() => expect(pip.configure).toHaveBeenCalledWith('', false, false));
  expect(result.current.ready).toBe(false);
  await expect(result.current.enter()).rejects.toThrow('Wait for the meeting');
  expect(pip.enter).not.toHaveBeenCalled();
  unmount();
});
it('reports denied native entry without leaving the app stuck in compact mode', async () => {
  const pip = adapter();
  pip.enter.mockRejectedValue(new Error('system denied'));
  const { result, unmount } = renderHook(() => useNativePictureInPicture(pip, meeting));
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await expect(result.current.enter()).rejects.toThrow('system denied');
  });
  expect(result.current.active).toBe(false);
  unmount();
});

it('retries a transient SDK participant setup failure instead of leaving floating call disabled', async () => {
  const pip = adapter();
  pip.configure.mockRejectedValueOnce(new Error('participant not ready'));
  const { result, unmount } = renderHook(() => useNativePictureInPicture(pip, meeting));
  await waitFor(() => {
    expect(pip.configure).toHaveBeenCalledTimes(2);
    expect(result.current.ready).toBe(true);
  });
  expect(result.current.error).toBeNull();
  unmount();
});

it('allows a manual retry while initial preparation has not yet succeeded', async () => {
  const pip = adapter();
  pip.configure.mockRejectedValueOnce(new Error('SDK not ready'));
  const { result, unmount } = renderHook(() => useNativePictureInPicture(pip, meeting));
  await waitFor(() => expect(pip.configure).toHaveBeenCalledTimes(1));
  expect(result.current.canEnter).toBe(true);
  await act(async () => {
    await result.current.enter();
  });
  expect(pip.enter).toHaveBeenCalledTimes(1);
  unmount();
});

it('cancels pending preparation retries when leaving the classroom', async () => {
  jest.useFakeTimers();
  try {
    const pip = adapter();
    pip.configure.mockRejectedValue(new Error('SDK not ready'));
    const { unmount } = renderHook(() => useNativePictureInPicture(pip, meeting));
    await act(async () => {});
    expect(pip.configure).toHaveBeenCalledWith('2', false, false);
    unmount();
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(pip.configure.mock.calls.filter(([id]) => id === '2')).toHaveLength(1);
    expect(pip.configure).toHaveBeenLastCalledWith('', false, false);
  } finally {
    jest.useRealTimers();
  }
});

it('keeps the camera protected from background pausing during the native entry handoff', async () => {
  let finish: () => void = () => {};
  const pip = adapter();
  pip.enter.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result, unmount } = renderHook(() => useNativePictureInPicture(pip, meeting));
  await waitFor(() => expect(result.current.ready).toBe(true));
  let entry: Promise<void>;
  act(() => {
    entry = result.current.enter();
  });
  expect(result.current.active).toBe(true);
  await act(async () => {
    finish();
    await entry!;
  });
  unmount();
});
