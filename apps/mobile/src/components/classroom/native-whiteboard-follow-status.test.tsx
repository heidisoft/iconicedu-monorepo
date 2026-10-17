import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeWhiteboardFollowStatus } from './native-whiteboard-follow-status';
jest.mock('@/providers/theme-provider', () => ({ useTheme: () => ({ colors: {} }) }));
it('makes exploring and resuming tutor follow reachable without menus', () => {
  const explore = jest.fn(),
    tutor = jest.fn();
  const screen = render(
    <NativeWhiteboardFollowStatus
      following
      label="Following tutor"
      status="waiting"
      onExplore={explore}
      onTutor={tutor}
    />,
  );
  expect(screen.getByText('Following tutor · waiting for their view')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Explore whiteboard freely'));
  expect(explore).toHaveBeenCalledTimes(1);
  screen.rerender(
    <NativeWhiteboardFollowStatus
      following={false}
      label=""
      status="waiting"
      onExplore={explore}
      onTutor={tutor}
    />,
  );
  expect(screen.getByText('Exploring freely')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Resume following tutor'));
  expect(tutor).toHaveBeenCalledTimes(1);
});
