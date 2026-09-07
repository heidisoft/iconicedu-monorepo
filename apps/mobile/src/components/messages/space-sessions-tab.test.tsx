import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import type {
  ChannelSessionCompletionVM,
  ClassScheduleVM,
} from '@iconicedu/shared-types';

import { SpaceSessionsTab } from './space-sessions-tab';

jest.mock('@/providers/theme-provider', () => {
  const { lightColors } = require('@/lib/theme');
  return { useTheme: () => ({ colors: lightColors, isDark: false }) };
});

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('@/lib/api/queries', () => ({
  fetchSpaceChannelMetaByChannelId: jest.fn().mockResolvedValue(null),
}));

jest.mock('lucide-react-native', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === '__esModule') return true;
        const Icon = (props: { testID?: string }) =>
          ReactModule.createElement(View, {
            testID: props?.testID ?? `icon-${String(name)}`,
          });
        Icon.displayName = `MockIcon(${String(name)})`;
        return Icon;
      },
    },
  );
});

// The classroom Sessions tab derives "now" from the system clock, so freeze it to
// a fixed Monday in September 2026 (matches the design screenshots).
const NOW = new Date('2026-09-07T12:00:00.000Z');

function makeSchedule(
  id: string,
  isoDay: string,
  status: ClassScheduleVM['status'] = 'scheduled',
): ClassScheduleVM {
  return {
    ids: { id, orgId: 'org-1' },
    title: 'Chess with Coach Rivi',
    startAt: `${isoDay}T09:30:00.000Z`,
    endAt: `${isoDay}T10:30:00.000Z`,
    status,
    visibility: 'class-members',
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: 'ls-1',
      channelId: 'chan-1',
    },
    audit: { createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'user-1' },
  };
}

function completionFor(schedule: ClassScheduleVM): ChannelSessionCompletionVM {
  return { scheduleId: schedule.ids.id, occurrenceKey: schedule.startAt };
}

// September 2026 — one cancelled session (Week 1) plus four scheduled sessions
// that every party has already confirmed, so the month reads 100% complete.
const SEPTEMBER = [
  makeSchedule('sep-w1', '2026-09-01', 'cancelled'),
  makeSchedule('sep-w2', '2026-09-08'),
  makeSchedule('sep-w3', '2026-09-15'),
  makeSchedule('sep-w4', '2026-09-22'),
  makeSchedule('sep-w5', '2026-09-29'),
];
const SEPTEMBER_COMPLETIONS = SEPTEMBER.filter((s) => s.status !== 'cancelled').map(
  completionFor,
);

// August 2026 — three elapsed sessions, one of them disputed, plus a cancelled
// one. Completion math should land at 2 of 3 → 67%.
const AUGUST = [
  makeSchedule('aug-w1', '2026-08-04'),
  makeSchedule('aug-w2', '2026-08-11'),
  makeSchedule('aug-w3', '2026-08-18'),
  makeSchedule('aug-w4', '2026-08-25', 'cancelled'),
];

describe('SpaceSessionsTab month progress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the current month at 100% when every scheduled session is confirmed', () => {
    render(
      <SpaceSessionsTab
        schedules={SEPTEMBER}
        sessionCompletions={SEPTEMBER_COMPLETIONS}
      />,
    );

    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByText('Current')).toBeTruthy();
    // Cancelled Week 1 is excluded from the scheduled count; the four confirmed
    // sessions carry the month to a full bar.
    expect(screen.getByText('4 sessions · 4 completed')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    // The all-complete check badge only renders once the month is fully done.
    expect(screen.getByTestId('icon-CheckCircle2')).toBeTruthy();
  });

  it('keeps the 100% current month even while its sessions are still upcoming', () => {
    render(
      <SpaceSessionsTab
        schedules={SEPTEMBER}
        sessionCompletions={SEPTEMBER_COMPLETIONS}
      />,
    );

    // Default sub-tab is "Upcoming"; the four future September sessions still list
    // a Join button, yet the month header already reports full completion.
    expect(screen.getByText('Sep · Week 2 · Session 1')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('reports a partial percentage and no check badge for a month with a disputed session', () => {
    render(
      <SpaceSessionsTab
        schedules={[...SEPTEMBER, ...AUGUST]}
        sessionCompletions={SEPTEMBER_COMPLETIONS}
        disputedSessions={[completionFor(AUGUST[2])]}
      />,
    );

    fireEvent.press(screen.getByText('Past'));

    expect(screen.getByText('August 2026')).toBeTruthy();
    expect(screen.getByText('3 sessions · 2 completed')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
    // September's badge is still present, August's is not.
    expect(screen.getAllByTestId('icon-CheckCircle2')).toHaveLength(1);
  });
});
