import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { openLiveSession } from '@/lib/messages/open-live-session';
import { useMeetingDialogLaunch } from './use-meeting-dialog-launch';

jest.mock('@/lib/messages/open-live-session', () => ({ openLiveSession: jest.fn() }));
const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
  jest.clearAllMocks();
});
it('waits for native iPad/iOS dismissal and opens only once', () => {
  Platform.OS = 'ios';
  const { result, rerender } = renderHook(
    ({ visible }) => useMeetingDialogLaunch(visible),
    {
      initialProps: { visible: true },
    },
  );
  act(() => result.current.queueLaunch('/live/synthetic'));
  rerender({ visible: false });
  expect(openLiveSession).not.toHaveBeenCalled();
  act(() => result.current.onDismiss());
  act(() => result.current.onDismiss());
  expect(openLiveSession).toHaveBeenCalledTimes(1);
  expect(openLiveSession).toHaveBeenCalledWith('/live/synthetic');
});
it('opens on Android after the dialog becomes hidden without requiring onDismiss', () => {
  Platform.OS = 'android';
  const { result, rerender } = renderHook(
    ({ visible }) => useMeetingDialogLaunch(visible),
    {
      initialProps: { visible: true },
    },
  );
  act(() => result.current.queueLaunch('/live/synthetic'));
  expect(openLiveSession).not.toHaveBeenCalled();
  rerender({ visible: false });
  expect(openLiveSession).toHaveBeenCalledTimes(1);
});
it('does not open when cancelled or unmounted', () => {
  Platform.OS = 'ios';
  const { result, rerender, unmount } = renderHook(
    ({ visible }) => useMeetingDialogLaunch(visible),
    {
      initialProps: { visible: true },
    },
  );
  rerender({ visible: false });
  act(() => result.current.onDismiss());
  expect(openLiveSession).not.toHaveBeenCalled();
  act(() => result.current.queueLaunch('/live/synthetic'));
  const dismiss = result.current.onDismiss;
  unmount();
  act(() => dismiss());
  expect(openLiveSession).not.toHaveBeenCalled();
});
