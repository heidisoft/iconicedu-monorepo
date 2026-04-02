/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminReportsOverview } from './admin-reports-overview';

describe('AdminReportsOverview', () => {
  it('renders KPI cards and chart headings', () => {
    render(
      <AdminReportsOverview
        dashboard={{
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: [
            {
              key: 'total-users',
              label: 'Total users',
              value: 42,
              description: 'All accounts in this organization.',
            },
          ],
          userSummary: [],
          classroomSummary: [],
          channelSummary: [],
          activitySummary: [],
          monthlyUserGrowth: [
            {
              bucketStart: '2026-03-01T00:00:00.000Z',
              label: 'Mar 2026',
              value: 4,
              series: 'guardian',
            },
          ],
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
        }}
      />,
    );

    expect(screen.getByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Monthly user growth')).toBeInTheDocument();
    expect(screen.getByText('Channel usage')).toBeInTheDocument();
    expect(screen.queryByText('Growth charts')).not.toBeInTheDocument();
  });

  it('renders empty states for charts without data', () => {
    render(
      <AdminReportsOverview
        dashboard={{
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
        }}
      />,
    );

    expect(screen.getAllByText('No report data yet').length).toBeGreaterThan(0);
  });
});
