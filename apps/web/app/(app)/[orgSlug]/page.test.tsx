import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import Page from '@iconicedu/web/app/(app)/[orgSlug]/page';

const dashboardHomeInfographicSectionMock = vi.fn(() => null);
const buildDashboardHomeInfographicMetricsMock = vi.fn();

vi.mock('@iconicedu/ui-web', () => ({
  DashboardHeader: () => null,
  DashboardHomeInfographicSection: (props: unknown) =>
    dashboardHomeInfographicSectionMock(props),
}));

vi.mock('@iconicedu/web/lib/dashboard/class-request', () => ({
  DASHBOARD_CLASS_REQUEST_SUBJECT_OPTIONS: [
    'Math',
    'English Language Arts',
    'Science',
    'Social Studies',
    'Computer Science',
    'Test Prep',
    'Study Skills',
    'Languages',
    'Arts',
    'Other',
  ],
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth', () => ({
  getDashboardAccountContext: vi.fn(async () => ({
    supabase: { key: 'supabase-client' },
    account: { id: 'account-1', org_id: 'org-1' },
  })),
  getDashboardProfileContext: vi.fn(async () => ({
    currentUserProfile: {
      kind: 'guardian',
      ids: { id: 'guardian-1', orgId: 'org-1', accountId: 'account-1' },
      profile: { displayName: 'Riley Morgan' },
      children: {
        items: [
          {
            ids: { id: 'child-1' },
            profile: { displayName: 'Maya Morgan' },
          },
        ],
      },
    },
  })),
}));

vi.mock('@iconicedu/web/lib/dashboard/home-infographic-metrics', () => ({
  buildDashboardHomeInfographicMetrics: (...args: unknown[]) =>
    buildDashboardHomeInfographicMetricsMock(...args),
}));

describe('d home page', () => {
  it('loads dashboard infographic metrics and renders infographic component', async () => {
    buildDashboardHomeInfographicMetricsMock.mockResolvedValueOnce({
      activeRole: 'parents',
      isStaffView: false,
      browseHref: '/iconic-academy/spaces',
      calendarHref: '/iconic-academy/class-schedule',
      inboxHref: '/iconic-academy/inbox',
      upcomingSessionsPage: { items: [], total: 0, pageSize: 6, totalPages: 1 },
      metricsByRole: {
        parents: {
          upcomingSessionsThisWeek: 4,
          completedClassesThisMonth: 10,
          activeSubjectsCount: 3,
          activeSubjectsLabel: 'Math, ELA, Science',
        },
        students: {
          upcomingSessionsThisWeek: 0,
          completedClassesThisMonth: 0,
          activeSubjectsCount: 0,
          activeSubjectsLabel: 'No active subjects yet',
        },
        tutors: {
          upcomingSessionsThisWeek: 0,
          completedClassesThisMonth: 0,
          activeSubjectsCount: 0,
          activeSubjectsLabel: 'No active subjects yet',
        },
      },
    });

    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    render(element as React.ReactElement);

    await waitFor(() => {
      expect(buildDashboardHomeInfographicMetricsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          orgSlug: 'iconic-academy',
          currentUserProfile: expect.objectContaining({ kind: 'guardian' }),
        }),
      );
    });

    expect(dashboardHomeInfographicSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgSlug: 'iconic-academy',
        isStaffView: false,
        isParentView: true,
        topMetrics: expect.objectContaining({
          upcomingSessionsThisWeek: 4,
        }),
        upcomingSessionsPage: expect.objectContaining({ pageSize: 6 }),
        calendarHref: '/iconic-academy/class-schedule',
        inboxHref: '/iconic-academy/inbox',
        browseHref: '/iconic-academy/spaces',
        canRequestClasses: true,
        requestRole: 'parents',
        requestableStudents: [
          {
            profileId: 'child-1',
            displayName: 'Maya Morgan',
          },
        ],
      }),
    );
  });
});
