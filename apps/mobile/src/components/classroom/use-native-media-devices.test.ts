import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNativeMediaDevices } from './use-native-media-devices';
import type { NativeMeetingAdapter } from '@/lib/classroom/meeting-controller';
it('refreshes selected devices after native selection and observes disconnection', async () => {
  let connected = true,
    selected = false;
  const adapter = {
    devices: jest.fn(async () => ({
      cameras: [],
      mirrored: false,
      audio: connected ? [{ id: 'headset', label: 'Headset', selected }] : [],
    })),
    selectAudioRoute: jest.fn(async () => {
      selected = true;
    }),
  };
  const { result, unmount } = renderHook(() =>
    useNativeMediaDevices(adapter as unknown as NativeMeetingAdapter, true),
  );
  await waitFor(() => expect(result.current.devices.audio).toHaveLength(1));
  await act(async () => {
    await result.current.select('audio', 'headset');
  });
  expect(result.current.devices.audio[0].selected).toBe(true);
  connected = false;
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.devices.audio).toHaveLength(0);
  unmount();
});
it('does not let a delayed device response replace a newer selection', async () => {
  let first!: (value: { cameras: []; audio: []; mirrored: boolean }) => void;
  const adapter = {
    devices: jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = resolve;
          }),
      )
      .mockResolvedValue({ cameras: [], audio: [], mirrored: true }),
  };
  const { result, unmount } = renderHook(() =>
    useNativeMediaDevices(adapter as unknown as NativeMeetingAdapter, true),
  );
  await act(async () => {
    await result.current.refresh();
  });
  await act(async () => {
    first({ cameras: [], audio: [], mirrored: false });
  });
  expect(result.current.devices.mirrored).toBe(true);
  unmount();
});

it('selects the microphone and refreshes both input and output after a route change', async () => {
  const adapter = {
    devices: jest
      .fn()
      .mockResolvedValue({ cameras: [], audio: [], microphones: [], mirrored: false }),
    selectMicrophone: jest.fn().mockResolvedValue(undefined),
  };
  const { result, unmount } = renderHook(() =>
    useNativeMediaDevices(adapter as unknown as NativeMeetingAdapter, true),
  );
  await act(async () => {
    await result.current.select('microphone', 'headset');
  });
  expect(adapter.selectMicrophone).toHaveBeenCalledWith('headset');
  expect(adapter.devices).toHaveBeenCalledTimes(2);
  unmount();
});
