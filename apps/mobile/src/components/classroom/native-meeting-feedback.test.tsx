import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NativeMeetingFeedback } from './native-meeting-feedback';
import { lightColors, darkColors } from '@/lib/theme';
let mockColors = lightColors;
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: mockColors }),
}));
it.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)(
  'uses the %s app theme and preserves the five-point feedback contract',
  async (_name, colors) => {
    mockColors = colors;
    const onSubmit = jest.fn().mockResolvedValue(undefined),
      onSkip = jest.fn();
    const screen = render(<NativeMeetingFeedback onSubmit={onSubmit} onSkip={onSkip} />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    fireEvent.press(screen.getByRole('radio', { name: 'Great' }));
    expect(screen.getByRole('radio', { name: 'Great', checked: true })).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Submit' })),
    );
    expect(onSubmit).toHaveBeenCalledWith(5);
  },
);
it('keeps rating and navigation disabled until submission finishes', async () => {
  let finish!: () => void;
  const onSubmit = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const onSkip = jest.fn();
  const screen = render(<NativeMeetingFeedback onSubmit={onSubmit} onSkip={onSkip} />);
  fireEvent.press(screen.getByRole('radio', { name: 'Good' }));
  fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
  fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
  fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Poor' }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSkip).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: 'Good', checked: true })).toBeTruthy();
  await act(async () => finish());
  expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled();
});
it('allows skipping without selecting or submitting a rating', () => {
  const onSubmit = jest.fn(),
    onSkip = jest.fn();
  const screen = render(<NativeMeetingFeedback onSubmit={onSubmit} onSkip={onSkip} />);
  fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});
