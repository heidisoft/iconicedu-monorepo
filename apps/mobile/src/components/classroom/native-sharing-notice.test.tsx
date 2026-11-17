import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NativeSharingNotice } from './native-sharing-notice';
jest.mock('@/providers/theme-provider', () => ({ useTheme: () => ({ colors: {} }) }));
it('labels the active source and prevents duplicate stop requests', async () => {
  let finish: () => void = () => {};
  const onStop = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const screen = render(<NativeSharingNotice whiteboard onStop={onStop} />);
  expect(screen.getByText('You are sharing the whiteboard')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Stop whiteboard sharing'));
  fireEvent.press(screen.getByLabelText('Stop whiteboard sharing'));
  expect(onStop).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Stopping…')).toBeTruthy();
  await act(async () => finish());
});
it('keeps stop available after a failed attempt', async () => {
  const onStop = jest
    .fn()
    .mockRejectedValueOnce(new Error('sdk'))
    .mockResolvedValue(undefined);
  const screen = render(<NativeSharingNotice whiteboard={false} onStop={onStop} />);
  await act(async () => fireEvent.press(screen.getByLabelText('Stop screen sharing')));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Unable to stop sharing. Please retry.',
  );
  await act(async () => fireEvent.press(screen.getByLabelText('Stop screen sharing')));
  expect(onStop).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});
