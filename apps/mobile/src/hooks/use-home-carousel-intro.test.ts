import { AccessibilityInfo, AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useHomeCarouselIntro } from './use-home-carousel-intro';
const mockStored = new Map<string, string>();
const mockSet = jest.fn(async (key: string, value: string) => {
  mockStored.set(key, value);
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStored.get(key) ?? null,
  setItem: (key: string, value: string) => mockSet(key, value),
}));
let scope = 0;
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'active',
  });
  mockStored.clear();
  mockSet.mockClear();
  scope++;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
it('advances exactly once and remembers this parent across remounts', async () => {
  const next = jest.fn();
  const account = `first-${scope}`;
  const view = renderHook(() => useHomeCarouselIntro(account, true, next));
  await flush();
  act(() => jest.advanceTimersByTime(2200));
  expect(next).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(20000));
  expect(next).toHaveBeenCalledTimes(1);
  view.unmount();
  renderHook(() => useHomeCarouselIntro(account, true, next));
  await flush();
  act(() => jest.advanceTimersByTime(2200));
  expect(next).toHaveBeenCalledTimes(1);
});
it('waits until the visible carousel is laid out with multiple slides', async () => {
  const next = jest.fn();
  const view = renderHook(
    ({ enabled }) => useHomeCarouselIntro(`ready-${scope}`, enabled, next),
    { initialProps: { enabled: false } },
  );
  await flush();
  act(() => jest.advanceTimersByTime(5000));
  expect(next).not.toHaveBeenCalled();
  view.rerender({ enabled: true });
  await flush();
  act(() => jest.advanceTimersByTime(2200));
  expect(next).toHaveBeenCalledTimes(1);
});
it.each(['motion', 'reader'])(
  'skips automatic motion for %s accessibility preferences',
  async (preference) => {
    if (preference === 'motion')
      jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    else jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
    const next = jest.fn();
    renderHook(() => useHomeCarouselIntro(`accessible-${scope}`, true, next));
    await flush();
    act(() => jest.advanceTimersByTime(5000));
    expect(next).not.toHaveBeenCalled();
  },
);
it('stops when the parent interacts before the delay', async () => {
  const next = jest.fn();
  const view = renderHook(() => useHomeCarouselIntro(`touch-${scope}`, true, next));
  await flush();
  act(() => view.result.current());
  act(() => jest.advanceTimersByTime(5000));
  expect(next).not.toHaveBeenCalled();
});
it('does not advance a backgrounded or unmounted carousel', async () => {
  const next = jest.fn();
  const view = renderHook(() => useHomeCarouselIntro(`background-${scope}`, true, next));
  await flush();
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'background',
  });
  act(() => jest.advanceTimersByTime(2200));
  expect(next).not.toHaveBeenCalled();
  view.unmount();
  act(() => jest.advanceTimersByTime(5000));
  expect(next).not.toHaveBeenCalled();
});
it('respects the stored seen state from a previous app session', async () => {
  const account = `stored-${scope}`;
  mockStored.set(`home-carousel-intro-v1:${account}:family-promotions`, '1');
  const next = jest.fn();
  renderHook(() => useHomeCarouselIntro(account, true, next));
  await flush();
  act(() => jest.advanceTimersByTime(5000));
  expect(next).not.toHaveBeenCalled();
});
