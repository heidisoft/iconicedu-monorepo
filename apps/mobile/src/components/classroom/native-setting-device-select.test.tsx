import React from 'react';
import { ActionSheetIOS, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Volume2 } from 'lucide-react-native';
import { NativeSettingDeviceSelect } from './native-setting-device-select';
const mockPickerFocus = jest.fn();
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const View = require('react-native').View;
  const Picker = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ focus: mockPickerFocus }));
    return <View {...props} />;
  });
  Picker.displayName = 'MockNativePicker';
  Picker.Item = function MockPickerItem() {
    return null;
  };
  return { Picker };
});
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      text: 'black',
      textMuted: 'gray',
      card: 'white',
      border: 'gray',
      action: 'green',
    },
    isDark: false,
  }),
}));
const devices = [
  { id: 'speaker', label: 'Speaker', selected: true },
  { id: 'headset', label: 'Headset', selected: false },
];
let choose: (index: number) => void;
let sheet: jest.SpyInstance;
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  sheet = jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((_options, callback) => {
      choose = callback;
    });
  jest.spyOn(ActionSheetIOS, 'dismissActionSheet').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
function setup(onSelect = jest.fn().mockResolvedValue(undefined), list = devices) {
  const screen = render(
    <NativeSettingDeviceSelect
      label="Audio output"
      icon={Volume2}
      devices={list}
      onSelect={onSelect}
    />,
  );
  const open = () => fireEvent.press(screen.getByLabelText('Audio output: Speaker'));
  return { screen, onSelect, open };
}
it('opens the native iOS sheet with the current route and Cancel', () => {
  const { open, onSelect } = setup();
  open();
  expect(sheet).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Audio output',
      options: ['Speaker (Current)', 'Headset', 'Cancel'],
      cancelButtonIndex: 2,
    }),
    expect.any(Function),
  );
  act(() => choose(2));
  expect(onSelect).not.toHaveBeenCalled();
});
it('does not switch when the current device is selected', () => {
  const { open, onSelect } = setup();
  open();
  act(() => choose(0));
  expect(onSelect).not.toHaveBeenCalled();
});
it('waits for the SDK and blocks duplicate requests', async () => {
  let complete!: () => void;
  const { screen, open, onSelect } = setup(
    jest.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    ),
  );
  open();
  act(() => {
    choose(1);
    choose(1);
  });
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith('headset');
  expect(screen.getByLabelText('Audio output: Speaker')).toBeDisabled();
  await act(async () => complete());
  expect(screen.getByLabelText('Audio output: Speaker')).toBeEnabled();
});
it('shows selection errors and allows retrying', async () => {
  const { screen, open, onSelect } = setup(
    jest
      .fn()
      .mockRejectedValueOnce(new Error('Disconnected'))
      .mockResolvedValue(undefined),
  );
  open();
  act(() => choose(1));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(/Reconnect the device/),
  );
  open();
  await act(async () => choose(1));
  expect(onSelect).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});
it('rejects devices disconnected while the sheet was open', () => {
  const { screen, open, onSelect } = setup();
  open();
  screen.rerender(
    <NativeSettingDeviceSelect
      label="Audio output"
      icon={Volume2}
      devices={[devices[0]]}
      onSelect={onSelect}
    />,
  );
  act(() => choose(1));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(/disconnected/);
});
it('explains when the system provides no selectable routes', () => {
  const { screen } = setup(undefined, []);
  expect(screen.getByText(/No selectable devices/)).toBeTruthy();
  expect(screen.getByLabelText('Audio output: System default')).toBeDisabled();
});
it('dismisses its iOS sheet when settings unmount', () => {
  const { screen, open } = setup();
  open();
  screen.unmount();
  expect(ActionSheetIOS.dismissActionSheet).toHaveBeenCalled();
});
it('uses the Android native dialog and forwards the selected ID', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const { screen, onSelect } = setup();
  fireEvent.press(screen.getByLabelText('Audio output: Speaker'));
  expect(mockPickerFocus).toHaveBeenCalledTimes(1);
  const picker = screen.UNSAFE_getByType(Picker);
  expect(picker.props.mode).toBe('dialog');
  expect(picker.props.selectedValue).toBe('speaker');
  await act(async () => picker.props.onValueChange('headset', 1));
  expect(onSelect).toHaveBeenCalledWith('headset');
  expect(sheet).not.toHaveBeenCalled();
});
