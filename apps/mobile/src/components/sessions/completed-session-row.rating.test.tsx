// Renders the real ActivityFeedbackRequest (completed-session-row.test.tsx mocks
// it) to guard the "first star tap is lost" regression.
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { lightColors } from '@/lib/theme';
import type { CompletedSessionRow as Row } from '@/lib/sessions/completed-sessions';

const mockRate = jest.fn();
jest.mock('@/lib/api/session-completions', () => ({
  rateSessionCompletion: (...args: unknown[]) => mockRate(...args),
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  return new Proxy({}, { get: () => () => <Text>icon</Text> });
});

jest.mock('@/components/activity/activity-completion-check', () => ({
  ActivityCompletionCheck: () => null,
}));

import { CompletedSessionRow } from './completed-session-row';

function completion(overrides: Partial<SessionCompletionVM> = {}): SessionCompletionVM {
  return {
    id: 'c-1',
    orgId: 'org-1',
    scheduleId: 's-1',
    occurrenceKey: '2026-11-03T15:00:00.000Z',
    profileId: 'p-1',
    role: 'guardian',
    status: 'confirmed',
    rescheduleRequested: false,
    sessionEndAt: '2026-11-03T16:00:00.000Z',
    expiresAt: '2026-11-06T16:00:00.000Z',
    confirmedBy: 'staff',
    rating: null,
    ...overrides,
  };
}

function row(c: SessionCompletionVM): Row {
  return {
    id: c.id,
    title: 'Algebra',
    startsAt: c.occurrenceKey,
    sessionEndAt: c.sessionEndAt,
    subtitle: null,
    statusLabel: 'Marked by staff',
    awaitingConfirmation: false,
    rating: null,
    completion: c,
    confirmedBy: 'staff',
    reportCount: 0,
    reportable: false,
    ratable: true,
  };
}

function starDisabled(screen: ReturnType<typeof render>, value: number) {
  const label = `Rate ${value} star${value === 1 ? '' : 's'}`;
  return screen.getByLabelText(label).props.accessibilityState?.disabled;
}

beforeEach(() => mockRate.mockReset().mockResolvedValue({ success: true }));

it('keeps the rating from the first star tap', async () => {
  const onRated = jest.fn();
  const screen = render(
    <CompletedSessionRow
      row={row(completion())}
      colors={lightColors}
      reportsEnabled={false}
      onRated={onRated}
    />,
  );

  fireEvent.press(screen.getByLabelText('Rate Algebra'));
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Rate 5 stars'));
  });

  await waitFor(() => expect(onRated).toHaveBeenCalledTimes(1));
  expect(mockRate).toHaveBeenCalledTimes(1);
  expect(mockRate).toHaveBeenCalledWith(
    expect.objectContaining({ sessionCompletionId: 'c-1', rating: 5 }),
  );
  // Still showing the submitted rating (stars locked), not reset to unrated.
  expect(starDisabled(screen, 5)).toBe(true);
});

it('lets a parent rate a session whose rating they skipped earlier', async () => {
  const screen = render(
    <CompletedSessionRow
      row={row(completion({ ratedAt: '2026-11-03T16:05:00.000Z' }))}
      colors={lightColors}
      reportsEnabled={false}
    />,
  );

  fireEvent.press(screen.getByLabelText('Rate Algebra'));
  expect(starDisabled(screen, 4)).toBe(false);

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Rate 5 stars'));
  });

  expect(mockRate).toHaveBeenCalledWith(expect.objectContaining({ rating: 5 }));
});
