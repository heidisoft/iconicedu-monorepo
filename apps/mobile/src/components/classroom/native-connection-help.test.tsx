import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeConnectionHelp } from './native-connection-help';
jest.mock('@/providers/theme-provider', () => ({ useTheme: () => ({ colors: {} }) }));
it('offers camera-off help only while the camera is on', () => {
  const off = jest.fn();
  const screen = render(<NativeConnectionHelp cameraOn onCameraOff={off} />);
  fireEvent.press(screen.getByLabelText('Turn camera off to improve connection'));
  expect(off).toHaveBeenCalledTimes(1);
  screen.rerender(<NativeConnectionHelp cameraOn={false} onCameraOff={off} />);
  expect(screen.queryByLabelText('Turn camera off to improve connection')).toBeNull();
  expect(screen.getByText(/Try a stronger Wi-Fi/)).toBeTruthy();
});
