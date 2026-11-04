import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeClassRoster } from './native-class-roster';
import type { ClassroomRosterVM } from '@iconicedu/shared-types';
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', actionSubtle: 'gray' } }),
}));
const roster: ClassroomRosterVM = {
  enabled: true,
  canCall: true,
  members: [
    {
      profileId: 'absent',
      displayName: 'Test student',
      kind: 'child',
      joined: false,
      canCall: true,
    },
    {
      profileId: 'joined',
      displayName: 'Joined student',
      kind: 'child',
      joined: true,
      canCall: false,
    },
  ],
};
it('lists absent members without duplicating attendees and calls only permitted members', () => {
  const call = jest.fn();
  const screen = render(
    <NativeClassRoster
      roster={roster}
      pending={null}
      error={null}
      call={call}
      cancel={jest.fn()}
    />,
  );
  expect(screen.queryByText('Joined student')).toBeNull();
  fireEvent.press(screen.getByLabelText('Call Test student'));
  expect(call).toHaveBeenCalledWith('absent');
});
it('keeps call failures visible and disables controls during a request', () => {
  const call = jest.fn();
  const screen = render(
    <NativeClassRoster
      roster={roster}
      pending="absent"
      error="Try again"
      call={call}
      cancel={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByLabelText('Call Test student'));
  expect(call).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Try again');
});
it('does not offer calling to a student viewing the roster', () => {
  const screen = render(
    <NativeClassRoster
      roster={{
        ...roster,
        canCall: false,
        members: [{ ...roster.members[0], canCall: false }],
      }}
      pending={null}
      error={null}
      call={jest.fn()}
      cancel={jest.fn()}
    />,
  );
  expect(screen.queryByLabelText('Call Test student')).toBeNull();
});
