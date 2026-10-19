import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeClassroomHeader } from './native-classroom-header';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', border: 'gray' } }),
}));
it('shows the join heading and standard back navigation', () => {
  const onBack = jest.fn();
  const screen = render(<NativeClassroomHeader onBack={onBack} />);
  expect(screen.getByRole('header', { name: 'Ready to join?' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
it('prevents leaving while the join request is in progress', () => {
  const onBack = jest.fn();
  const screen = render(<NativeClassroomHeader onBack={onBack} disabled />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).not.toHaveBeenCalled();
});
