import React from 'react';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeAnnotationBar } from './native-annotation-bar';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', card: 'white', border: 'gray' } }),
}));
it('opens from a single pencil and closes from the same animated pill', () => {
  const onToggle = jest.fn();
  const screen = render(
    <NativeAnnotationBar expanded={false} width={320} onToggle={onToggle}>
      <Text>Drawing tools</Text>
    </NativeAnnotationBar>,
  );
  expect(screen.queryByText('Drawing tools')).toBeNull();
  fireEvent.press(screen.getByLabelText('Open annotation toolbar'));
  expect(onToggle).toHaveBeenCalledTimes(1);
  screen.rerender(
    <NativeAnnotationBar expanded width={320} onToggle={onToggle}>
      <Text>Drawing tools</Text>
    </NativeAnnotationBar>,
  );
  expect(screen.getByText('Drawing tools')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close annotation toolbar'));
  expect(onToggle).toHaveBeenCalledTimes(2);
});
it('honors reduced motion rather than animating the expansion', async () => {
  const preference = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const timing = jest.spyOn(Animated, 'timing');
  const screen = render(
    <NativeAnnotationBar expanded={false} width={320} onToggle={jest.fn()}>
      <Text>Tools</Text>
    </NativeAnnotationBar>,
  );
  await waitFor(() =>
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 0 }),
    ),
  );
  screen.rerender(
    <NativeAnnotationBar expanded width={320} onToggle={jest.fn()}>
      <Text>Tools</Text>
    </NativeAnnotationBar>,
  );
  expect(timing).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ duration: 0, toValue: 320 }),
  );
  preference.mockRestore();
  timing.mockRestore();
});
