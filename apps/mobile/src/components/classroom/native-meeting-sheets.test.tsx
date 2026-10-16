import React from 'react';
import { KeyboardAvoidingView, Modal } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeChatSheet, NativeMeetingSheet } from './native-meeting-sheets';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: { text: 'black', card: 'white', actionSubtle: 'gray', red: 'red' },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 64, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
it('preserves a failed chat draft and allows retrying', async () => {
  const onSend = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined);
  const screen = render(
    <NativeChatSheet open messages={[]} canSend onSend={onSend} onClose={() => {}} />,
  );
  fireEvent.changeText(screen.getByLabelText('Message'), 'Please explain step two');
  fireEvent.press(screen.getByLabelText('Send message'));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Message could not be sent. Try again.',
    ),
  );
  expect(screen.getByLabelText('Message').props.value).toBe('Please explain step two');
  fireEvent.press(screen.getByLabelText('Send message'));
  await waitFor(() => expect(screen.getByLabelText('Message').props.value).toBe(''));
  expect(onSend).toHaveBeenCalledTimes(2);
});
it('prevents duplicate sends and preserves text entered while sending', async () => {
  let resolve: () => void = () => {};
  const onSend = jest.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const screen = render(
    <NativeChatSheet open messages={[]} canSend onSend={onSend} onClose={() => {}} />,
  );
  fireEvent.changeText(screen.getByLabelText('Message'), 'First message');
  fireEvent.press(screen.getByLabelText('Send message'));
  fireEvent(screen.getByLabelText('Message'), 'submitEditing');
  expect(onSend).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Send message').props.accessibilityState.busy).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Message'), 'Next message');
  await act(async () => resolve());
  expect(screen.getByLabelText('Message').props.value).toBe('Next message');
});
it('dismisses compact controls by tapping outside the sheet', () => {
  const onClose = jest.fn();
  const screen = render(
    <NativeMeetingSheet open compact title="More controls" onClose={onClose} />,
  );
  fireEvent.press(screen.getByLabelText('Dismiss More controls'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('accounts for an inset iOS sheet when keeping the composer above the keyboard', () => {
  const screen = render(<NativeMeetingSheet open title="Chat" onClose={() => {}} />, {
    createNodeMock: () => ({
      measureInWindow: (callback: (x: number, y: number) => void) => callback(0, 64),
    }),
  });
  fireEvent(screen.UNSAFE_getByType(Modal), 'show');
  expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(
    64,
  );
});
