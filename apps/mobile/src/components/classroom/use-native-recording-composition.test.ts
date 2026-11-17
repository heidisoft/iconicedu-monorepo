import { act, renderHook } from '@testing-library/react-native';
import type {
  NativeMeetingAdapter,
  NativeMeetingController,
  NativeMeetingState,
} from '@/lib/classroom/meeting-controller';
import { useNativeRecordingComposition } from './use-native-recording-composition';
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it('announces actual native readiness and removes the announcement on cleanup', async () => {
  const compositionStatus = jest.fn().mockResolvedValue(true);
  const announceComposition = jest.fn().mockResolvedValue(undefined);
  const state = {
    phase: 'meeting',
    selfId: '1',
    recording: false,
    sharingUserIds: ['1'],
    composited: [],
  } as unknown as NativeMeetingState;
  const controller = {
    snapshot: () => state,
    composition: jest.fn(),
  } as unknown as NativeMeetingController;
  const { unmount } = renderHook(() =>
    useNativeRecordingComposition(
      { compositionStatus, announceComposition } as unknown as NativeMeetingAdapter,
      controller,
      state,
    ),
  );
  await act(async () => {});
  expect(announceComposition).toHaveBeenCalledWith(true);
  expect(controller.composition).toHaveBeenCalledWith('1', true);
  compositionStatus.mockResolvedValue(false);
  await act(async () => jest.advanceTimersByTime(1000));
  expect(controller.composition).toHaveBeenCalledWith('1', false);
  unmount();
  expect(announceComposition).toHaveBeenLastCalledWith(false);
  const reads = compositionStatus.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(5000));
  expect(compositionStatus).toHaveBeenCalledTimes(reads);
});
it('requires content after the startup grace period for an uncomposed presenter', async () => {
  const state = {
    phase: 'meeting',
    recording: true,
    recordingPaused: false,
    sharingUserIds: ['2'],
    composited: [],
  } as unknown as NativeMeetingState;
  const controller = { composition: jest.fn() } as unknown as NativeMeetingController;
  const { unmount } = renderHook(() =>
    useNativeRecordingComposition({} as NativeMeetingAdapter, controller, state),
  );
  await act(async () => jest.advanceTimersByTime(2999));
  expect(controller.composition).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));
  expect(controller.composition).toHaveBeenCalledWith('2', false, true);
  unmount();
});
