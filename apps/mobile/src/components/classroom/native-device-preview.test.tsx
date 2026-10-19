import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeDevicePreview } from './native-device-preview';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      text: 'black',
      card: 'white',
      actionSubtle: 'gray',
      action: 'green',
      actionForeground: 'white',
      border: 'gray',
      textMuted: 'gray',
    },
  }),
}));
function setup(joining = false) {
  const props = {
    displayName: 'Test teacher',
    sessionName: 'Math class',
    camera: true,
    microphone: false,
    joining,
    onDisplayName: jest.fn(),
    onCamera: jest.fn(),
    onMicrophone: jest.fn(),
    onSettings: jest.fn(),
    onJoin: jest.fn(),
  };
  return {
    props,
    screen: render(
      <NativeDevicePreview {...props}>
        <Text>Camera preview</Text>
      </NativeDevicePreview>,
    ),
  };
}
it('retains signed-in identity and requires explicit Join after preview', () => {
  const { props, screen } = setup();
  expect(
    screen.getByLabelText('Change display name, currently Test teacher'),
  ).toBeTruthy();
  expect(screen.getByText('Camera preview')).toBeTruthy();
  expect(props.onJoin).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Test audio and video')).toBeNull();
  fireEvent.press(screen.getByLabelText('Settings'));
  expect(props.onSettings).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Join now'));
  expect(props.onJoin).toHaveBeenCalledTimes(1);
});
it('prevents duplicate join and media changes while joining', () => {
  const { props, screen } = setup(true);
  fireEvent.press(screen.getByLabelText('Joining…'));
  fireEvent.press(screen.getByLabelText('Turn camera off'));
  expect(props.onJoin).not.toHaveBeenCalled();
  expect(props.onCamera).not.toHaveBeenCalled();
});
it.each([false, true])('centers the join label while joining is %s', (joining) => {
  const { screen } = setup(joining);
  expect(
    screen.getByRole('button', { name: joining ? 'Joining…' : 'Join now' }),
  ).toHaveStyle({
    alignItems: 'center',
    justifyContent: 'center',
  });
});

it('edits the name with explicit save and cancel controls', () => {
  const { props, screen } = setup();
  fireEvent.press(screen.getByLabelText('Change display name, currently Test teacher'));
  fireEvent.changeText(screen.getByLabelText('Your display name'), 'Edited name');
  fireEvent.press(screen.getByLabelText('Save name'));
  expect(props.onDisplayName).toHaveBeenCalledWith('Edited name');
});
