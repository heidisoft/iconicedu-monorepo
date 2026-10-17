import { AccessibilityInfo } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useReducedMotion } from './use-reduced-motion';
it('starts without motion, follows the OS preference and removes its listener', async () => {
  let receive: (value: boolean) => void = () => {};
  const remove = jest.fn();
  const read = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  const listen = jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((_name, callback) => {
      receive = callback;
      return { remove };
    });
  const { result, unmount } = renderHook(useReducedMotion);
  expect(result.current).toBe(true);
  await act(async () => {});
  expect(result.current).toBe(false);
  act(() => receive(true));
  expect(result.current).toBe(true);
  unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  read.mockRestore();
  listen.mockRestore();
});
