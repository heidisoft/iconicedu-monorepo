import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { DashboardHomeInfographicSection } from './dashboard-home-infographic-section';

const sessionItems = [
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
    channelId: 'channel-1',
    joinHref: '/iconic-academy/s/channel-1',
    chatHref: '/iconic-academy/s/channel-1',
    weekBucket: 'today',
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
    channelId: 'channel-2',
    joinHref: '/iconic-academy/s/channel-2',
    chatHref: '/iconic-academy/s/channel-2',
    weekBucket: 'this-week',
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
    channelId: 'channel-3',
    joinHref: '/iconic-academy/s/channel-3',
    chatHref: '/iconic-academy/s/channel-3',
    weekBucket: 'next-week',
  },
];

const sessionPage = {
  today: {
    items: sessionItems.filter((item) => item.weekBucket === 'today'),
    total: 1,
    pageSize: 1,
    totalPages: 1,
  },
  thisWeek: {
    items: sessionItems.filter((item) => item.weekBucket === 'this-week'),
    total: 1,
    pageSize: 1,
    totalPages: 1,
  },
  nextWeek: {
    items: sessionItems.filter((item) => item.weekBucket === 'next-week'),
    total: 1,
    pageSize: 1,
    totalPages: 1,
  },
} as const;

const combinedPaginationSessionPage = {
  today: {
    items: sessionItems.filter((item) => item.weekBucket === 'today'),
    total: 1,
    pageSize: 2,
    totalPages: 1,
  },
  thisWeek: {
    items: sessionItems.filter((item) => item.weekBucket === 'this-week'),
    total: 1,
    pageSize: 2,
    totalPages: 1,
  },
  nextWeek: {
    items: sessionItems.filter((item) => item.weekBucket === 'next-week'),
    total: 1,
    pageSize: 2,
    totalPages: 1,
  },
} as const;

const singlePageSessionPage = {
  today: {
    items: sessionItems.filter((item) => item.weekBucket === 'today'),
    total: 1,
    pageSize: 3,
    totalPages: 1,
  },
  thisWeek: {
    items: sessionItems.filter((item) => item.weekBucket === 'this-week'),
    total: 1,
    pageSize: 3,
    totalPages: 1,
  },
  nextWeek: {
    items: sessionItems.filter((item) => item.weekBucket === 'next-week'),
    total: 1,
    pageSize: 3,
    totalPages: 1,
  },
} as const;

describe('DashboardHomeInfographicSection', () => {
  const originalFetch = global.fetch;
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    global.fetch = vi.fn() as typeof fetch;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('renders the same session item component content and paginates across the combined upcoming list', async () => {
    const user = userEvent.setup();

    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        topMetrics={{
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        }}
        upcomingSessionsPage={{ ...sessionPage }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Dashboard classroom sessions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Math 101')).toBeInTheDocument();
    expect(screen.queryByText('Science 301')).not.toBeInTheDocument();
    expect(screen.queryByText('ELA 201')).not.toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Message' })).toHaveLength(1);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('ELA 201')).toBeInTheDocument();
    expect(screen.queryByText('Math 101')).not.toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('separates visible upcoming sessions into today and this week sections', () => {
    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        topMetrics={{
          upcomingSessionsThisWeek: 2,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        }}
        upcomingSessionsPage={combinedPaginationSessionPage}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getAllByText('This week').length).toBeGreaterThan(1);
    expect(screen.queryByText('Next week')).not.toBeInTheDocument();
    expect(screen.getByText('Math 101')).toBeInTheDocument();
    expect(screen.getByText('ELA 201')).toBeInTheDocument();
    expect(screen.queryByText('Science 301')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Join/i })).toHaveLength(2);
  });

  it('uses session item join action handler path', async () => {
    const onJoinSession = vi.fn();
    const user = userEvent.setup();

    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        topMetrics={{
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        }}
        upcomingSessionsPage={{ ...sessionPage }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
        onJoinSession={onJoinSession}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: /Join/i })[0]!);
    expect(onJoinSession).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'channel-1',
        joinHref: '/iconic-academy/s/channel-1',
      }),
    );
  });

  it('hides join button for next week sessions while keeping message actions', () => {
    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        topMetrics={{
          upcomingSessionsThisWeek: 2,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        }}
        upcomingSessionsPage={singlePageSessionPage}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    expect(screen.getAllByRole('button', { name: /Join/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Message' })).toHaveLength(3);
  });

  it('shows Active Students tile for tutor view', () => {
    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        isTutorView
        topMetrics={{
          upcomingSessionsThisWeek: 2,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 4,
          activeSubjectsLabel: '4 active students',
        }}
        upcomingSessionsPage={combinedPaginationSessionPage}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    expect(screen.getByText('Active Students')).toBeInTheDocument();
    expect(screen.queryByText('Active Subjects')).not.toBeInTheDocument();
    expect(screen.getByText('4 active students')).toBeInTheDocument();
  });

  it('renders parent CTA and opens family settings tab', async () => {
    const user = userEvent.setup();
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        isParentView
        topMetrics={{
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        }}
        upcomingSessionsPage={{ ...sessionPage }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
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

  it('shows boost your learning section for student view', () => {
    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        isStudentView
        canRequestClasses
        requestRole="students"
        requestableStudents={[{ profileId: 'child-1', displayName: 'Maya Morgan' }]}
        topMetrics={{
          upcomingSessionsThisWeek: 2,
          completedClassesThisMonth: 3,
          activeSubjectsCount: 2,
          activeSubjectsLabel: 'Math, Science',
        }}
        upcomingSessionsPage={{
          today: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          thisWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          nextWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
        }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    expect(screen.getByText('Boost Your Learning!')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Explore More Classes' }),
    ).toBeInTheDocument();
  });

  it('renders empty state when no classroom sessions are available', () => {
    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        topMetrics={{
          upcomingSessionsThisWeek: 0,
          completedClassesThisMonth: 0,
          activeSubjectsCount: 0,
          activeSubjectsLabel: 'No active subjects yet',
        }}
        upcomingSessionsPage={{
          today: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          thisWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          nextWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
        }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    expect(screen.getByText('No upcoming sessions this week')).toBeInTheDocument();
    expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('shows next week count in the upcoming sessions tile when this week is empty', () => {
    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        topMetrics={{
          upcomingSessionsThisWeek: 0,
          completedClassesThisMonth: 0,
          activeSubjectsCount: 0,
          activeSubjectsLabel: 'No active subjects yet',
        }}
        upcomingSessionsPage={{
          today: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          thisWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          nextWeek: {
            items: sessionItems.filter((item) => item.weekBucket === 'next-week'),
            total: 1,
            pageSize: 3,
            totalPages: 1,
          },
        }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    expect(screen.getAllByText('Upcoming Sessions').length).toBeGreaterThan(1);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getAllByText('Next week').length).toBeGreaterThan(1);
  });

  it('keeps explore classes as link for non-parent/student roles', () => {
    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        topMetrics={{
          upcomingSessionsThisWeek: 2,
          completedClassesThisMonth: 2,
          activeSubjectsCount: 2,
          activeSubjectsLabel: 'Math, Science',
        }}
        upcomingSessionsPage={{
          today: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          thisWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          nextWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
        }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    expect(screen.queryByText('Boost Your Learning!')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Explore More Classes' }),
    ).not.toBeInTheDocument();
  });

  it('opens request dialog for parents and submits successfully', async () => {
    const user = userEvent.setup();
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const onClassRequestCreated = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, channelId: 'channel-55' }),
    });

    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        isParentView
        canRequestClasses
        requestRole="parents"
        requestableStudents={[
          { profileId: 'child-1', displayName: 'Maya Morgan' },
          { profileId: 'child-2', displayName: 'Tevin Morgan' },
        ]}
        topMetrics={{
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 2,
          activeSubjectsCount: 2,
          activeSubjectsLabel: 'Math, Science',
        }}
        upcomingSessionsPage={{
          today: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          thisWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          nextWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
        }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
        onClassRequestCreated={onClassRequestCreated}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Explore More Classes' })[0]!);

    expect(screen.getByText('How would you like to start?')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Trial class/i }));
    expect(screen.getByText('Student name')).toBeInTheDocument();
    const comboboxes = screen.getAllByRole('combobox');

    await user.click(comboboxes[0]!);
    await user.click(screen.getByRole('option', { name: 'Maya Morgan' }));

    await user.click(comboboxes[1]!);
    await user.click(screen.getByRole('option', { name: 'Math' }));

    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/class-requests',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(requestInit?.body))).toEqual(
      expect.objectContaining({
        requestIntent: 'trial-class',
        studentProfileIds: ['child-1'],
        subjects: ['Math'],
      }),
    );

    await waitFor(() => {
      expect(onClassRequestCreated).toHaveBeenCalledWith('channel-55');
    });
  });

  it('student dialog locks student selection and supports Other subject', async () => {
    const user = userEvent.setup();

    render(
      <DashboardHomeInfographicSection
        orgSlug="iconic-academy"
        isStudentView
        canRequestClasses
        requestRole="students"
        requestableStudents={[{ profileId: 'child-1', displayName: 'Maya Morgan' }]}
        topMetrics={{
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 2,
          activeSubjectsCount: 2,
          activeSubjectsLabel: 'Math, Science',
        }}
        upcomingSessionsPage={{
          today: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          thisWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
          nextWeek: { items: [], total: 0, pageSize: 3, totalPages: 1 },
        }}
        calendarHref="/iconic-academy/class-schedule"
        notificationsHref="/iconic-academy/notifications"
        browseHref="/iconic-academy/s"
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Explore More Classes' })[0]!);

    const [studentSelect, subjectSelect] = screen.getAllByRole('combobox');
    expect(studentSelect).toBeDisabled();

    await user.click(subjectSelect!);
    await user.click(screen.getByRole('option', { name: 'Other' }));
    expect(screen.getByLabelText('Other subject')).toBeInTheDocument();
  });
});
