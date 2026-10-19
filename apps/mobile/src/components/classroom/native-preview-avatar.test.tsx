import React from 'react';
import { render } from '@testing-library/react-native';
import { NativePreviewAvatar } from './native-preview-avatar';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', actionSubtle: 'gray' } }),
}));
it('shows initials and identifies the camera-off participant', () => {
  const screen = render(<NativePreviewAvatar name="Student One" />);
  expect(screen.getByText('SO')).toBeTruthy();
  expect(
    screen.getByRole('image', { name: 'Student One avatar, camera off' }),
  ).toBeTruthy();
});
it('updates the avatar when the display name changes', () => {
  const screen = render(<NativePreviewAvatar name="Student One" />);
  screen.rerender(<NativePreviewAvatar name="Learner Two" />);
  expect(screen.getByText('LT')).toBeTruthy();
  expect(screen.queryByText('SO')).toBeNull();
});
it('uses a generic avatar when no name is selected', () => {
  const screen = render(<NativePreviewAvatar name=" " />);
  expect(
    screen.getByRole('image', { name: 'Participant avatar, camera off' }),
  ).toBeTruthy();
});
