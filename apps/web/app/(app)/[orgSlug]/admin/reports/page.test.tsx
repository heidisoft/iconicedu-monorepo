import { describe, expect, it, vi } from 'vitest';

import Page from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/page';
import ActivityPage from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/activity/page';
import ChannelsPage from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/channels/page';
import ClassroomsPage from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/classrooms/page';
import UsersPage from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/users/page';

const loadAdminReportsDashboardMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error('not-found');
});

vi.mock(
  '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/_lib/load-admin-reports-dashboard',
  () => ({
    loadAdminReportsDashboard: (...args: unknown[]) =>
      loadAdminReportsDashboardMock(...args),
  }),
);

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

describe('admin reports page', () => {
  it('renders the overview with dashboard data', async () => {
    loadAdminReportsDashboardMock.mockResolvedValue({
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: [],
      userSummary: [],
      classroomSummary: [],
      channelSummary: [],
      activitySummary: [],
      monthlyUserGrowth: [],
      monthlyUsageByRole: [],
      monthlyAttendance: [],
      monthlyCompletedSessions: [],
      weeklyCompletedSessions: [],
      upcomingScheduledSessionsByWeek: [],
      inboxActivityByMonth: [],
      inboxReadRateByMonth: [],
      growthSeries: [],
      completedSessionsByTeacher: [],
      completedSessionsByFamily: [],
      channelUsage: [],
      channelTypeMix: [],
      notificationDispatchByChannel: [],
      inboxActivityByVerb: [],
    });

    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    const children = (element as { props?: { children?: unknown[] } }).props
      ?.children as unknown[];
    const contentContainer = children?.[1] as
      | { props?: { children?: unknown } }
      | undefined;
    const contentChildren = contentContainer?.props?.children as unknown[];
    const overviewElement = contentChildren?.[1] as
      | { props?: { dashboard?: { generatedAt?: string } } }
      | undefined;

    expect(overviewElement?.props?.dashboard?.generatedAt).toBe(
      '2026-04-02T12:00:00.000Z',
    );
  });

  it('propagates report loading failures', async () => {
    loadAdminReportsDashboardMock.mockRejectedValue(new Error('load failed'));

    await expect(
      Page({
        params: Promise.resolve({ orgSlug: 'iconic-academy' }),
      }),
    ).rejects.toThrow('load failed');
  });

  it('renders the users report page', async () => {
    loadAdminReportsDashboardMock.mockResolvedValue({
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: [],
      userSummary: [],
      classroomSummary: [],
      channelSummary: [],
      activitySummary: [],
      monthlyUserGrowth: [],
      monthlyUsageByRole: [],
      monthlyAttendance: [],
      monthlyCompletedSessions: [],
      weeklyCompletedSessions: [],
      upcomingScheduledSessionsByWeek: [],
      inboxActivityByMonth: [],
      inboxReadRateByMonth: [],
      growthSeries: [],
      completedSessionsByTeacher: [],
      completedSessionsByFamily: [],
      channelUsage: [],
      channelTypeMix: [],
      notificationDispatchByChannel: [],
      inboxActivityByVerb: [],
    });

    const element = await UsersPage({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    const headerElement = (element as { props?: { children?: unknown[] } }).props
      ?.children?.[0] as { props?: { title?: string } } | undefined;

    expect(headerElement?.props?.title).toBe('User reports');
  });

  it('renders the classrooms report page', async () => {
    loadAdminReportsDashboardMock.mockResolvedValue({
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: [],
      userSummary: [],
      classroomSummary: [],
      channelSummary: [],
      activitySummary: [],
      monthlyUserGrowth: [],
      monthlyUsageByRole: [],
      monthlyAttendance: [],
      monthlyCompletedSessions: [],
      weeklyCompletedSessions: [],
      upcomingScheduledSessionsByWeek: [],
      inboxActivityByMonth: [],
      inboxReadRateByMonth: [],
      growthSeries: [],
      completedSessionsByTeacher: [],
      completedSessionsByFamily: [],
      channelUsage: [],
      channelTypeMix: [],
      notificationDispatchByChannel: [],
      inboxActivityByVerb: [],
    });

    const element = await ClassroomsPage({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    const headerElement = (element as { props?: { children?: unknown[] } }).props
      ?.children?.[0] as { props?: { title?: string } } | undefined;

    expect(headerElement?.props?.title).toBe('Classrooms & sessions reports');
  });

  it('renders the channels report page', async () => {
    loadAdminReportsDashboardMock.mockResolvedValue({
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: [],
      userSummary: [],
      classroomSummary: [],
      channelSummary: [],
      activitySummary: [],
      monthlyUserGrowth: [],
      monthlyUsageByRole: [],
      monthlyAttendance: [],
      monthlyCompletedSessions: [],
      weeklyCompletedSessions: [],
      upcomingScheduledSessionsByWeek: [],
      inboxActivityByMonth: [],
      inboxReadRateByMonth: [],
      growthSeries: [],
      completedSessionsByTeacher: [],
      completedSessionsByFamily: [],
      channelUsage: [],
      channelTypeMix: [],
      notificationDispatchByChannel: [],
      inboxActivityByVerb: [],
    });

    const element = await ChannelsPage({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    const headerElement = (element as { props?: { children?: unknown[] } }).props
      ?.children?.[0] as { props?: { title?: string } } | undefined;

    expect(headerElement?.props?.title).toBe('Channel reports');
  });

  it('renders the activity report page', async () => {
    loadAdminReportsDashboardMock.mockResolvedValue({
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: [],
      userSummary: [],
      classroomSummary: [],
      channelSummary: [],
      activitySummary: [],
      monthlyUserGrowth: [],
      monthlyUsageByRole: [],
      monthlyAttendance: [],
      monthlyCompletedSessions: [],
      weeklyCompletedSessions: [],
      upcomingScheduledSessionsByWeek: [],
      inboxActivityByMonth: [],
      inboxReadRateByMonth: [],
      growthSeries: [],
      completedSessionsByTeacher: [],
      completedSessionsByFamily: [],
      channelUsage: [],
      channelTypeMix: [],
      notificationDispatchByChannel: [],
      inboxActivityByVerb: [],
    });

    const element = await ActivityPage({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    const headerElement = (element as { props?: { children?: unknown[] } }).props
      ?.children?.[0] as { props?: { title?: string } } | undefined;

    expect(headerElement?.props?.title).toBe('Activity reports');
  });
});
