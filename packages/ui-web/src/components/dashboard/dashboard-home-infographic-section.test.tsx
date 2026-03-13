import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DashboardHomeInfographicSection } from './dashboard-home-infographic-section';

const sessionPage = {
  items: [
    {
      session: {
        id: 'schedule-1__2026-03-13T16:00:00.000Z',
        label: 'Math 101',
        time: 'Fri 4:00pm',
        dayName: 'Fri',
        dayNum: '13',
        isToday: true,
        isLive: false,
        isPast: false,
        endAt: '2026-03-13T17:00:00.000Z',
        status: 'scheduled',
      },
      joinHref: '/iconic-academy/spaces/channel-1',
      chatHref: '/iconic-academy/spaces/channel-1',
    },
    {
      session: {
        id: 'schedule-2__2026-03-14T16:00:00.000Z',
        label: 'ELA 201',
        time: 'Sat 4:00pm',
        dayName: 'Sat',
        dayNum: '14',
        isToday: false,
        isLive: false,
        isPast: false,
        endAt: '2026-03-14T17:00:00.000Z',
        status: 'scheduled',
      },
      joinHref: '/iconic-academy/spaces/channel-2',
      chatHref: '/iconic-academy/spaces/channel-2',
    },
    {
      session: {
        id: 'schedule-3__2026-03-15T16:00:00.000Z',
        label: 'Science 301',
        time: 'Sun 4:00pm',
        dayName: 'Sun',
        dayNum: '15',
        isToday: false,
        isLive: false,
        isPast: false,
        endAt: '2026-03-15T17:00:00.000Z',
        status: 'scheduled',
      },
      joinHref: '/iconic-academy/spaces/channel-3',
      chatHref: '/iconic-academy/spaces/channel-3',
    },
  ],
  total: 3,
  pageSize: 2,
  totalPages: 2,
} as const;

describe('DashboardHomeInfographicSection', () => {
  it('renders the same session item component content and paginates client-side', async () => {
    const user = userEvent.setup();

    render(
      <DashboardHomeInfographicSection
        topMetrics={{
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        }}
        upcomingSessionsPage={{ ...sessionPage }}
        calendarHref="/iconic-academy/class-schedule"
        inboxHref="/iconic-academy/inbox"
        browseHref="/iconic-academy/spaces"
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Dashboard classroom sessions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Math 101')).toBeInTheDocument();
    expect(screen.getByText('ELA 201')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Message' })).toHaveLength(2);
    expect(screen.queryByText('Science 301')).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Science 301')).toBeInTheDocument();
    expect(screen.queryByText('Math 101')).not.toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('uses session item join action handler path', async () => {
    const onJoinSession = vi.fn();
    const user = userEvent.setup();

    render(
      <DashboardHomeInfographicSection
        topMetrics={{
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        }}
        upcomingSessionsPage={{ ...sessionPage }}
        calendarHref="/iconic-academy/class-schedule"
        inboxHref="/iconic-academy/inbox"
        browseHref="/iconic-academy/spaces"
        onJoinSession={onJoinSession}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: /Join/i })[0]!);
    expect(onJoinSession).toHaveBeenCalledWith('/iconic-academy/spaces/channel-1');
  });

  it('renders parent CTA and opens family settings tab', async () => {
    const user = userEvent.setup();
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <DashboardHomeInfographicSection
        isParentView
        topMetrics={{
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        }}
        upcomingSessionsPage={{ ...sessionPage }}
        calendarHref="/iconic-academy/class-schedule"
        inboxHref="/iconic-academy/inbox"
        browseHref="/iconic-academy/spaces"
      />,
    );

    expect(screen.getAllByText('Manage my family')).toHaveLength(2);
    expect(
      screen.getByText('Update your children profiles and household links'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Manage my family' }));

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'iconicedu:open-user-settings',
        detail: { tab: 'family' },
      }),
    );
  });

  it('renders empty state when no classroom sessions are available', () => {
    render(
      <DashboardHomeInfographicSection
        topMetrics={{
          upcomingSessionsThisWeek: 0,
          completedClassesThisMonth: 0,
          activeSubjectsCount: 0,
          activeSubjectsLabel: 'No active subjects yet',
        }}
        upcomingSessionsPage={{ items: [], total: 0, pageSize: 3, totalPages: 1 }}
        calendarHref="/iconic-academy/class-schedule"
        inboxHref="/iconic-academy/inbox"
        browseHref="/iconic-academy/spaces"
      />,
    );

    expect(screen.getByText('No upcoming sessions this week')).toBeInTheDocument();
    expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
