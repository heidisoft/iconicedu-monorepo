import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeClassroomSettings } from './native-classroom-settings';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: { text: 'black', card: 'white', actionSubtle: 'gray', red: 'red' },
  }),
}));
it('shows the selected settings section and routes dismissal through cleanup', () => {
  const onTab = jest.fn(),
    onClose = jest.fn();
  const screen = render(
    <NativeClassroomSettings
      open
      tab="audio"
      onTab={onTab}
      onClose={onClose}
      audio={<Text>Microphone check</Text>}
      video={<Text>Background options</Text>}
    />,
  );
  expect(screen.getByText('Microphone check')).toBeTruthy();
  expect(screen.queryByText('Background options')).toBeNull();
  fireEvent.press(screen.getByLabelText('Video settings tab'));
  expect(onTab).toHaveBeenCalledWith('video');
  fireEvent.press(screen.getByLabelText('Close settings'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
