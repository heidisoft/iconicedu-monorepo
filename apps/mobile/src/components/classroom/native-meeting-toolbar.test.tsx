import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeMeetingToolbar } from './native-meeting-toolbar';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      text: 'black',
      card: 'white',
      actionSubtle: 'gray',
      red: 'red',
      primaryForeground: 'white',
    },
  }),
}));
function action(label: string, onPress = jest.fn(), disabled = false) {
  return (
    <Pressable
      key={label}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}
it('keeps common actions accessible and reveals secondary actions under More', () => {
  const claim = jest.fn();
  const screen = render(
    <NativeMeetingToolbar>
      {action('Mute microphone')}
      {action('Leave meeting')}
      {action('Claim host', claim)}
    </NativeMeetingToolbar>,
  );
  expect(screen.getByLabelText('Mute microphone')).toBeTruthy();
  expect(screen.queryByLabelText('Claim host')).toBeNull();
  fireEvent.press(screen.getByLabelText('More controls'));
  fireEvent.press(screen.getByLabelText('Claim host'));
  expect(claim).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Close more controls'));
  expect(screen.queryByLabelText('Claim host')).toBeNull();
});
it('preserves disabled primary actions without making them callable', () => {
  const share = jest.fn();
  const screen = render(
    <NativeMeetingToolbar>{action('Share screen', share, true)}</NativeMeetingToolbar>,
  );
  fireEvent.press(screen.getByLabelText('Share screen'));
  expect(share).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('More controls')).toBeNull();
});
