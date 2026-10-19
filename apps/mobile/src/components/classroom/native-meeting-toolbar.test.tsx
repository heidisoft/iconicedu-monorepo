import React from 'react';
import { Modal, Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeMeetingToolbar } from './native-meeting-toolbar';
function press(element: Parameters<typeof fireEvent.press>[0]) {
  fireEvent.press(element);
  // The native host sends onDismiss after the slide finishes on iOS.
  const { screen } = require('@testing-library/react-native');
  for (const modal of screen.UNSAFE_getAllByType(Modal)) {
    if (!modal.props.visible && modal.props.onDismiss) fireEvent(modal, 'dismiss');
  }
}
jest.mock('./use-reduced-motion', () => ({ useReducedMotion: () => true }));
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
      {action('Leave class')}
      {action('Claim host', claim)}
    </NativeMeetingToolbar>,
  );
  expect(screen.getByLabelText('Mute microphone')).toBeTruthy();
  expect(screen.queryByLabelText('Claim host')).toBeNull();
  press(screen.getByLabelText('More controls'));
  press(screen.getByLabelText('Claim host'));
  expect(claim).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Claim host')).toBeNull();
});
it('preserves disabled primary actions without making them callable', () => {
  const share = jest.fn();
  const screen = render(
    <NativeMeetingToolbar>{action('Share screen', share, true)}</NativeMeetingToolbar>,
  );
  press(screen.getByLabelText('Share screen'));
  expect(share).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Share screen').props.accessibilityState.disabled).toBe(
    true,
  );
});

it.each([
  'Audio settings',
  'Switch camera',
  'Messages',
  'Participants',
  'Invite',
  'Turn captions on',
  'Start recording',
])('opens %s from More and dismisses the menu', (label) => {
  const onPress = jest.fn();
  const screen = render(
    <NativeMeetingToolbar>{action(label, onPress)}</NativeMeetingToolbar>,
  );
  expect(screen.queryByLabelText(label)).toBeNull();
  press(screen.getByLabelText('More controls'));
  press(screen.getByLabelText(label));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText(label)).toBeNull();
});
it('closes More without invoking an action', () => {
  const onPress = jest.fn();
  const screen = render(
    <NativeMeetingToolbar>{action('Settings', onPress)}</NativeMeetingToolbar>,
  );
  press(screen.getByLabelText('More controls'));
  press(screen.getByLabelText('Close More controls'));
  expect(onPress).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Settings')).toBeNull();
});

it('waits for native dismissal before opening a destination panel on iOS', () => {
  const onPress = jest.fn();
  const screen = render(
    <NativeMeetingToolbar>{action('Audio settings', onPress)}</NativeMeetingToolbar>,
  );
  fireEvent.press(screen.getByLabelText('More controls'));
  fireEvent.press(screen.getByLabelText('Audio settings'));
  expect(onPress).not.toHaveBeenCalled();
  fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');
  expect(onPress).toHaveBeenCalledTimes(1);
  fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss');
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('places screen sharing third with chat in More', () => {
  const screen = render(
    <NativeMeetingToolbar>
      {action('Mute microphone')}
      {action('Stop video')}
      {action('Share screen')}
      {action('Messages')}
      {action('Leave class')}
    </NativeMeetingToolbar>,
  );
  expect(
    screen.getAllByRole('button').map((button) => button.props.accessibilityLabel),
  ).toEqual([
    'Mute microphone',
    'Stop video',
    'Share screen',
    'More controls',
    'Leave class',
  ]);
});
it('keeps whiteboard beside media and device settings in unified Settings', () => {
  const screen = render(
    <NativeMeetingToolbar>
      {action('Mute microphone')}
      {action('Stop video')}
      {action('Whiteboard')}
      {action('Share screen')}
      {action('Settings')}
      {action('Leave class')}
    </NativeMeetingToolbar>,
  );
  expect(screen.queryByLabelText('Audio settings')).toBeNull();
  expect(screen.queryByLabelText('Video settings')).toBeNull();
  expect(
    screen.getAllByRole('button').map((button) => button.props.accessibilityLabel),
  ).toEqual([
    'Mute microphone',
    'Stop video',
    'Whiteboard',
    'Share screen',
    'More controls',
    'Leave class',
  ]);
  press(screen.getByLabelText('More controls'));
  expect(screen.getByLabelText('Settings')).toBeTruthy();
});
