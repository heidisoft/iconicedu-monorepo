import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { lightColors } from '@/lib/theme';
import type { CompletedSessionRow as Row } from '@/lib/sessions/completed-sessions';

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const Icon = () => <Text>icon</Text>;
  return { Clock3: Icon, Flag: Icon, Star: Icon, X: Icon };
});

jest.mock('@/components/activity/activity-feedback-request', () => ({
  ActivityFeedbackRequest: ({ onRatingSubmit }: { onRatingSubmit: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable accessibilityLabel="Rate 5 stars" onPress={onRatingSubmit}>
        <Text>rating-widget</Text>
      </Pressable>
    );
  },
}));

jest.mock('@/components/activity/activity-completion-check', () => ({
  ActivityCompletionCheck: () => null,
}));

import { CompletedSessionRow } from './completed-session-row';

const completion = { id: 'c-1', orgId: 'org-1' } as SessionCompletionVM;

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 'c-1',
    title: 'Algebra',
    startsAt: '2026-11-03T15:00:00.000Z',
    sessionEndAt: '2026-11-03T16:00:00.000Z',
    subtitle: 'Sam',
    statusLabel: 'Marked by staff',
    awaitingConfirmation: false,
    rating: null,
    completion,
    confirmedBy: 'staff',
    reportCount: 0,
    reportable: true,
    ratable: true,
    ...overrides,
  };
}

it('shows who marked it complete and offers a report for staff-marked sessions', () => {
  const onReport = jest.fn();
  const screen = render(
    <CompletedSessionRow
      row={row()}
      colors={lightColors}
      reportsEnabled
      onReport={onReport}
    />,
  );

  expect(screen.getByText('Marked by staff')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Report Algebra as wrongly marked complete'));
  expect(onReport).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-1' }));
});

it('hides the report action while the reports flag is off', () => {
  const screen = render(
    <CompletedSessionRow
      row={row()}
      colors={lightColors}
      reportsEnabled={false}
      onReport={jest.fn()}
    />,
  );

  expect(screen.queryByLabelText('Report Algebra as wrongly marked complete')).toBeNull();
});

it('shows Reported instead of the action once reported', () => {
  const screen = render(
    <CompletedSessionRow
      row={row()}
      colors={lightColors}
      reportsEnabled
      reportedLocally
      onReport={jest.fn()}
    />,
  );

  expect(screen.getByText('Reported')).toBeTruthy();
  expect(screen.queryByLabelText('Report Algebra as wrongly marked complete')).toBeNull();
});

it('opens the rating widget for an unrated session and hides it after rating', () => {
  const onRated = jest.fn();
  const screen = render(
    <CompletedSessionRow
      row={row({ confirmedBy: 'self', statusLabel: 'Confirmed', reportable: false })}
      colors={lightColors}
      reportsEnabled
      onRated={onRated}
    />,
  );

  fireEvent.press(screen.getByLabelText('Rate Algebra'));
  fireEvent.press(screen.getByLabelText('Rate 5 stars'));

  expect(onRated).toHaveBeenCalled();
  expect(screen.queryByLabelText('Rate Algebra')).toBeNull();
});

it('offers no actions on an already-rated, self-confirmed session', () => {
  const screen = render(
    <CompletedSessionRow
      row={row({
        confirmedBy: 'self',
        statusLabel: 'Confirmed',
        reportable: false,
        ratable: false,
        rating: 4,
      })}
      colors={lightColors}
      reportsEnabled
      onReport={jest.fn()}
    />,
  );

  expect(screen.queryByLabelText('Rate Algebra')).toBeNull();
  expect(screen.queryByLabelText('Report Algebra as wrongly marked complete')).toBeNull();
  expect(screen.getByText('4')).toBeTruthy();
});

it('shows the report count on admin rows', () => {
  const screen = render(
    <CompletedSessionRow
      row={row({
        completion: null,
        confirmedBy: null,
        statusLabel: 'Confirmed',
        reportable: false,
        ratable: false,
        reportCount: 2,
      })}
      colors={lightColors}
      reportsEnabled
    />,
  );

  expect(screen.getByText('Reported (2)')).toBeTruthy();
});
