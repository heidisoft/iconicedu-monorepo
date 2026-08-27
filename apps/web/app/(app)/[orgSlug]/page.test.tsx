// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import { HomePageContent } from './home-page-content';

const dashboardHomeInfographicSectionMock = vi.fn(() => null);
const enableAnyVisibleClassSessionJoinRunMock = vi.fn(async () => false);
const listClassSessionJoinAvailabilityMock = vi.fn(async () => []);
const buildDashboardHomeInfographicMetricsMock = vi.fn();
const getDashboardAccountContextMock = vi.fn(async () => ({
  supabase: { key: 'supabase-client' },
  account: { id: 'account-1', org_id: 'org-1' },
}));
const getDashboardProfileContextMock = vi.fn(async () => ({
  currentUserProfile: {
    kind: 'guardian',
    ids: { id: 'guardian-1', orgId: 'org-1', accountId: 'account-1' },
    profile: { displayName: 'Riley Morgan' },
    prefs: { timezone: 'America/New_York' },
    children: {
      items: [
        {
          ids: { id: 'child-1' },
          profile: { displayName: 'Maya Morgan' },
        },
      ],
    },
  },
}));

vi.mock('@iconicedu/ui-web', () => ({
  DashboardHeader: () => null,
  DashboardHomeSkeleton: () => null,
  DashboardHomeInfographicSection: (props: unknown) =>
    dashboardHomeInfographicSectionMock(props),
}));

vi.mock('../../../lib/subjects/queries/org-subject-catalog.query', () => ({
  listActiveOrgSubjectCatalog: vi.fn(async () => ({
    data: [{ subject: 'Math' }, { subject: 'Science' }],
    error: null,
  })),
  mapOrgSubjectRowsToOptions: vi.fn((rows?: Array<{ subject: string }>) =>
    (rows ?? []).map((row) => row.subject),
  ),
}));

vi.mock('./_shared/dashboard-auth', () => ({
  getDashboardAccountContext: (...args: unknown[]) =>
    getDashboardAccountContextMock(...args),
  getDashboardProfileContext: (...args: unknown[]) =>
    getDashboardProfileContextMock(...args),
}));

vi.mock('@iconicedu/web/flags', () => ({
  enableAnyVisibleClassSessionJoin: {
    run: (...args: unknown[]) => enableAnyVisibleClassSessionJoinRunMock(...args),
  },
}));

vi.mock('@iconicedu/web/lib/live-sessions/api-client', () => ({
  createLiveSessionsApiClient: () => ({
    listClassSessionJoinAvailability: (...args: unknown[]) =>
      listClassSessionJoinAvailabilityMock(...args),
  }),
}));

vi.mock('../../../lib/dashboard/home-infographic-metrics', () => ({
  buildDashboardHomeInfographicMetrics: (...args: unknown[]) =>
    buildDashboardHomeInfographicMetricsMock(...args),
}));

describe('d home page', () => {
  it('loads dashboard infographic metrics and renders infographic component', async () => {
    buildDashboardHomeInfographicMetricsMock.mockResolvedValueOnce({
      activeRole: 'parents',
      isStaffView: false,
      browseHref: '/iconic-academy/s',
      calendarHref: '/iconic-academy/class-schedule',
      notificationsHref: '/iconic-academy/notifications',
      upcomingSessionsPage: {
        thisWeek: { items: [], total: 0, pageSize: 6, totalPages: 1 },
        nextWeek: { items: [], total: 0, pageSize: 6, totalPages: 1 },
      },
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

    const element = await HomePageContent({ orgSlug: 'iconic-academy' });
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
        upcomingSessionsPage: expect.objectContaining({
          thisWeek: expect.objectContaining({ pageSize: 6 }),
          nextWeek: expect.objectContaining({ pageSize: 6 }),
        }),
        calendarHref: '/iconic-academy/class-schedule',
        notificationsHref: '/iconic-academy/notifications',
        browseHref: '/iconic-academy/s',
        canRequestClasses: true,
        requestRole: 'parents',
        requestableStudents: [
          {
            profileId: 'child-1',
            displayName: 'Maya Morgan',
          },
        ],
        subjectOptions: ['Math', 'Science'],
      }),
    );
  });

  it('keeps guardian home metrics when account has multiple personas', async () => {
    getDashboardProfileContextMock.mockResolvedValueOnce({
      currentUserProfile: {
        kind: 'guardian',
        ids: { id: 'guardian-1', orgId: 'org-1', accountId: 'account-1' },
        profile: { displayName: 'Riley Morgan' },
        prefs: { timezone: 'America/New_York' },
        children: {
          items: [
            {
              ids: { id: 'child-1' },
              profile: { displayName: 'Maya Morgan' },
            },
          ],
        },
      },
      availablePersonas: [
        { profileId: 'guardian-1', kind: 'guardian', isActive: true },
        { profileId: 'educator-2', kind: 'educator', isActive: false },
      ],
    });
    buildDashboardHomeInfographicMetricsMock.mockResolvedValueOnce({
      activeRole: 'parents',
      isStaffView: false,
      browseHref: '/iconic-academy/s',
      calendarHref: '/iconic-academy/class-schedule',
      notificationsHref: '/iconic-academy/notifications',
      upcomingSessionsPage: {
        thisWeek: { items: [], total: 0, pageSize: 6, totalPages: 1 },
        nextWeek: { items: [], total: 0, pageSize: 6, totalPages: 1 },
      },
      metricsByRole: {
        parents: {
          upcomingSessionsThisWeek: 7,
          completedClassesThisMonth: 12,
          activeSubjectsCount: 2,
          activeSubjectsLabel: 'Math, Science',
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

    const element = await HomePageContent({ orgSlug: 'iconic-academy' });
    render(element as React.ReactElement);

    await waitFor(() => {
      expect(buildDashboardHomeInfographicMetricsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUserProfile: expect.objectContaining({
            kind: 'guardian',
            ids: expect.objectContaining({ id: 'guardian-1' }),
          }),
        }),
      );
    });

    expect(dashboardHomeInfographicSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isParentView: true,
        topMetrics: expect.objectContaining({
          upcomingSessionsThisWeek: 7,
          completedClassesThisMonth: 12,
        }),
      }),
    );
  });
});
