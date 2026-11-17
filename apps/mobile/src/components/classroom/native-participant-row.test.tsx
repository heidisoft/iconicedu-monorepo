import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeParticipantRow } from './native-participant-row';
const user = {
  id: 'peer',
  name: 'Test student',
  host: false,
  cohost: false,
  muted: true,
  video: false,
};
it('shows media state and puts authorized participant actions behind More', () => {
  const screen = render(
    <NativeParticipantRow user={user} isYou={false} handRaised canManage>
      <Text>Mute participant</Text>
    </NativeParticipantRow>,
  );
  expect(screen.getByText('Test student')).toBeTruthy();
  expect(screen.getByLabelText('Microphone off')).toBeTruthy();
  expect(screen.getByLabelText('Camera off')).toBeTruthy();
  expect(screen.getByLabelText('Test student raised their hand')).toBeTruthy();
  expect(screen.queryByText('Mute participant')).toBeNull();
  fireEvent.press(screen.getByLabelText('More actions for Test student'));
  expect(screen.getByText('Mute participant')).toBeTruthy();
});
it('does not expose moderation actions to viewers', () => {
  const screen = render(
    <NativeParticipantRow user={user} isYou handRaised={false} canManage={false}>
      <Text>Mute participant</Text>
    </NativeParticipantRow>,
  );
  expect(screen.getByText('Test student (You)')).toBeTruthy();
  expect(screen.queryByLabelText('More actions for Test student')).toBeNull();
  expect(screen.queryByText('Mute participant')).toBeNull();
});
