import React from 'react';
import { NativeModules, Share } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NativeInvitationSheet } from './native-invitation-sheet';
jest.mock('./use-reduced-motion', () => ({ useReducedMotion: () => true }));
jest.mock('@/providers/theme-provider', () => ({ useTheme: () => ({ colors: {} }) }));
it('copies the link and passcode separately and shares labelled invitation details', async () => {
  NativeModules.ClassroomControls = { copyText: jest.fn().mockResolvedValue(true) };
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction });
  const screen = render(
    <NativeInvitationSheet
      open
      onClose={() => {}}
      title="Lesson"
      link="https://example.test/class"
      passcode="fixture-code"
    />,
  );
  await act(async () => fireEvent.press(screen.getByLabelText('Copy join link')));
  expect(NativeModules.ClassroomControls.copyText).toHaveBeenCalledWith(
    'https://example.test/class',
  );
  await act(async () => fireEvent.press(screen.getByLabelText('Copy passcode')));
  expect(NativeModules.ClassroomControls.copyText).toHaveBeenCalledWith('fixture-code');
  await act(async () => fireEvent.press(screen.getByLabelText('Share invitation')));
  expect(share).toHaveBeenCalledWith({
    message: 'Lesson\nJoin link: https://example.test/class\nPasscode: fixture-code',
  });
  share.mockRestore();
});
it('reports a copy failure without claiming success', async () => {
  NativeModules.ClassroomControls = {
    copyText: jest.fn().mockRejectedValue(new Error('unavailable')),
  };
  const screen = render(
    <NativeInvitationSheet open onClose={() => {}} title="Lesson" link="fixture-link" />,
  );
  await act(async () => fireEvent.press(screen.getByLabelText('Copy join link')));
  expect(screen.getByText('Unable to copy. Please retry.')).toBeTruthy();
  expect(screen.queryByLabelText('Copy passcode')).toBeNull();
});
