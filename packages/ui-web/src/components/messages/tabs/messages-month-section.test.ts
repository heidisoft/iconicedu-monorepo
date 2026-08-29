import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ChannelVM } from '@iconicedu/shared-types';
import { MessagesStateProvider } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import type { MonthGroup } from './messages-schedule-tab.utils';
import {
  formatMonthSectionProgressLabel,
  getMonthSectionStats,
  MonthSection,
  shouldMonthSectionStartOpen,
} from './messages-month-section';

const monthGroup: MonthGroup = {
  monthKey: '2026-03',
  month: 'March',
  year: '2026',
  totalCount: 4,
  completedCount: 3,
  sessions: [],
};

describe('messages-month-section', () => {
  it('calculates progress and completion flags', () => {
    expect(getMonthSectionStats(monthGroup)).toEqual({
      progressPercent: 75,
      allComplete: false,
      scheduledCount: 4,
      completedCount: 3,
    });
    expect(getMonthSectionStats({ ...monthGroup, completedCount: 4 })).toEqual({
      progressPercent: 100,
      allComplete: true,
      scheduledCount: 4,
      completedCount: 4,
    });
  });

  it('prefers provided scheduled-vs-completed month stats for the progress bar', () => {
    expect(
      getMonthSectionStats(monthGroup, {
        scheduledCount: 6,
        completedCount: 3,
      }),
    ).toEqual({
      progressPercent: 50,
      allComplete: false,
      scheduledCount: 6,
      completedCount: 3,
    });
  });

  it('opens first/current sections by default when requested', () => {
    expect(shouldMonthSectionStartOpen(true, false)).toBe(true);
    expect(shouldMonthSectionStartOpen(false, true)).toBe(true);
    expect(shouldMonthSectionStartOpen(false, false)).toBe(false);
  });

  it('formats the month progress label with percent and ratio', () => {
    expect(formatMonthSectionProgressLabel(50, 3, 6)).toBe('50% 3/6');
  });

  it('opens the exact session link from a read-only staff classroom tile', async () => {
    const user = userEvent.setup();
    const staffChannel = {
      ids: { id: 'channel-1', orgId: 'org-1' },
      context: {
        liveSession: {
          enabled: true,
          joinUrl: 'https://zoom.us/j/channel-default',
        },
      },
      ui: { quickActions: [] },
    } as unknown as ChannelVM;
    const staffMonthGroup: MonthGroup = {
      monthKey: '2026-03',
      month: 'March',
      year: '2026',
      totalCount: 1,
      completedCount: 0,
      sessions: [
        {
          id: 'session-1',
          label: 'Math session',
          time: 'Tue 4:00pm',
          dayName: 'Tue',
          dayNum: '3',
          isToday: false,
          isLive: false,
          isPast: false,
          endAt: '2026-03-03T17:00:00.000Z',
          status: 'scheduled',
          meetingLink: 'https://meet.google.com/exact-session',
        },
      ],
    };

    render(
      React.createElement(
        MessagesStateProvider,
        {
          channel: staffChannel,
          isReadOnly: true,
        } as React.ComponentProps<typeof MessagesStateProvider>,
        React.createElement(MonthSection, {
          group: staffMonthGroup,
          isCurrentMonth: true,
          joinableSessionId: 'session-1',
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Join' }));

    expect(screen.getByText('Session ready to join')).toBeInTheDocument();
    expect(screen.getByText('https://meet.google.com/exact-session')).toBeInTheDocument();
    expect(
      screen.queryByText('https://zoom.us/j/channel-default'),
    ).not.toBeInTheDocument();
  });
});
