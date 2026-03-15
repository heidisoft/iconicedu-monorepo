import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildClassSchedulesByOrgMock,
  getLearningSpacesByOrgMock,
  getLearningSpaceParticipantsByLearningSpaceIdsMock,
} = vi.hoisted(() => ({
  buildClassSchedulesByOrgMock: vi.fn(),
  getLearningSpacesByOrgMock: vi.fn(),
  getLearningSpaceParticipantsByLearningSpaceIdsMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/schedules/builders/class-schedule.builder', () => ({
  buildClassSchedulesByOrg: (...args: unknown[]) => buildClassSchedulesByOrgMock(...args),
}));

vi.mock('@iconicedu/web/lib/spaces/queries/learning-spaces.query', () => ({
  getLearningSpacesByOrg: (...args: unknown[]) => getLearningSpacesByOrgMock(...args),
}));

vi.mock('@iconicedu/web/lib/spaces/queries/learning-space-relations.query', () => ({
  getLearningSpaceParticipantsByLearningSpaceIds: (...args: unknown[]) =>
    getLearningSpaceParticipantsByLearningSpaceIdsMock(...args),
}));

import { buildDashboardHomeInfographicMetrics } from '@iconicedu/web/lib/dashboard/home-infographic-metrics';

const NOW = new Date('2026-03-13T12:00:00.000Z');

function buildSchedule(overrides?: Record<string, unknown>) {
  return {
    ids: { id: 'schedule-1', orgId: 'org-1' },
    title: 'Algebra Daily',
    description: null,
    startAt: '2026-03-10T15:00:00.000Z',
    endAt: '2026-03-10T16:00:00.000Z',
    timezone: 'UTC',
    status: 'scheduled',
    visibility: 'internal',
    themeKey: null,
    source: {
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      sessionId: null,
    },
    participants: [
      {
        ids: { id: 'child-1', orgId: 'org-1' },
        role: 'child',
        status: 'accepted',
        displayName: 'Student One',
      },
      {
        ids: { id: 'educator-1', orgId: 'org-1' },
        role: 'educator',
        status: 'accepted',
        displayName: 'Tutor Jane',
      },
    ],
    recurrence: {
      ids: { id: 'rec-1', orgId: 'org-1' },
      rule: {
        frequency: 'daily',
        interval: 1,
        until: '2026-03-20T15:00:00.000Z',
        timezone: 'UTC',
      },
    },
    audit: {
      createdAt: '2026-03-01T00:00:00.000Z',
      createdBy: 'staff-1',
    },
    ...overrides,
  };
}

describe('buildDashboardHomeInfographicMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds guardian metrics from linked child participation and zeros other tabs', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([buildSchedule()]);
    getLearningSpacesByOrgMock.mockResolvedValue({
      data: [
        { id: 'space-1', status: 'active', subject: 'Math' },
        { id: 'space-2', status: 'active', subject: 'Science' },
        { id: 'space-3', status: 'archived', subject: 'History' },
      ],
    });
    getLearningSpaceParticipantsByLearningSpaceIdsMock.mockResolvedValue({
      data: [
        { learning_space_id: 'space-1', profile_id: 'child-1' },
        { learning_space_id: 'space-2', profile_id: 'child-1' },
      ],
    });

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: NOW,
      currentUserProfile: {
        kind: 'guardian',
        ids: { id: 'guardian-1', orgId: 'org-1', accountId: 'account-1' },
        children: {
          items: [
            {
              kind: 'child',
              ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
            },
          ],
        },
      } as never,
    });

    expect(result.activeRole).toBe('parents');
    expect(result.browseHref).toBe('/iconic-academy/spaces');
    expect(result.metricsByRole.parents).toEqual({
      upcomingSessionsThisWeek: 3,
      completedClassesThisMonth: 3,
      activeSubjectsCount: 2,
      activeSubjectsLabel: 'Math, Science',
    });
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(3);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(5);
    expect(result.upcomingSessionsPage.thisWeek.items[0]).toMatchObject({
      session: { label: 'Algebra Daily' },
      joinHref: '/iconic-academy/spaces/channel-1',
      weekBucket: 'this-week',
    });
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).toContain(
      'Student One',
    );
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).toContain(
      'Tutor Jane',
    );
    expect(result.upcomingSessionsPage.thisWeek.total).toBe(3);
    expect(result.upcomingSessionsPage.nextWeek.total).toBe(5);
    expect(result.metricsByRole.students).toEqual({
      upcomingSessionsThisWeek: 0,
      completedClassesThisMonth: 0,
      activeSubjectsCount: 0,
      activeSubjectsLabel: 'No active subjects yet',
    });
    expect(result.metricsByRole.tutors).toEqual({
      upcomingSessionsThisWeek: 0,
      completedClassesThisMonth: 0,
      activeSubjectsCount: 0,
      activeSubjectsLabel: 'No active subjects yet',
    });
  });

  it('builds student metrics from current child profile scope', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([
      buildSchedule(),
      buildSchedule({
        ids: { id: 'schedule-2', orgId: 'org-1' },
        participants: [{ ids: { id: 'child-2', orgId: 'org-1' }, role: 'child' }],
      }),
    ]);
    getLearningSpacesByOrgMock.mockResolvedValue({
      data: [{ id: 'space-1', status: 'active', subject: 'Math' }],
    });
    getLearningSpaceParticipantsByLearningSpaceIdsMock.mockResolvedValue({
      data: [{ learning_space_id: 'space-1', profile_id: 'child-1' }],
    });

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: NOW,
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
      } as never,
    });

    expect(result.activeRole).toBe('students');
    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(3);
    expect(result.metricsByRole.students.completedClassesThisMonth).toBe(3);
    expect(result.metricsByRole.students.activeSubjectsCount).toBe(1);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(3);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(5);
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).toContain(
      'Tutor Jane',
    );
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).not.toContain(
      'Student One',
    );
    expect(result.metricsByRole.parents.upcomingSessionsThisWeek).toBe(0);
    expect(result.metricsByRole.tutors.upcomingSessionsThisWeek).toBe(0);
  });

  it('builds tutor metrics from educator profile scope', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([
      buildSchedule({
        participants: [
          {
            ids: { id: 'educator-1', orgId: 'org-1' },
            role: 'educator',
            displayName: 'Tutor Jane',
          },
          {
            ids: { id: 'child-9', orgId: 'org-1' },
            role: 'child',
            displayName: 'Student Nine',
          },
        ],
      }),
      buildSchedule({
        ids: { id: 'schedule-manual', orgId: 'org-1' },
        source: {
          kind: 'manual',
          createdByUserId: 'staff-1',
        },
        participants: [{ ids: { id: 'educator-1', orgId: 'org-1' }, role: 'educator' }],
      }),
    ]);
    getLearningSpacesByOrgMock.mockResolvedValue({
      data: [{ id: 'space-1', status: 'active', subject: 'English' }],
    });
    getLearningSpaceParticipantsByLearningSpaceIdsMock.mockResolvedValue({
      data: [{ learning_space_id: 'space-1', profile_id: 'educator-1' }],
    });

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: NOW,
      currentUserProfile: {
        kind: 'educator',
        ids: { id: 'educator-1', orgId: 'org-1', accountId: 'account-e1' },
      } as never,
    });

    expect(result.activeRole).toBe('tutors');
    expect(result.metricsByRole.tutors).toEqual({
      upcomingSessionsThisWeek: 3,
      completedClassesThisMonth: 3,
      activeSubjectsCount: 1,
      activeSubjectsLabel: 'English',
    });
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(3);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(5);
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).toContain(
      'Student Nine',
    );
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).not.toContain(
      'Tutor Jane',
    );
    expect(result.metricsByRole.parents.activeSubjectsCount).toBe(0);
    expect(result.metricsByRole.students.activeSubjectsCount).toBe(0);
  });

  it('builds staff metrics with organization-wide classroom totals and management links', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([
      buildSchedule({
        ids: { id: 'schedule-staff-1', orgId: 'org-1' },
        participants: [
          {
            ids: { id: 'child-11', orgId: 'org-1' },
            role: 'child',
            displayName: 'Staff Student One',
          },
          {
            ids: { id: 'educator-11', orgId: 'org-1' },
            role: 'educator',
            displayName: 'Staff Tutor One',
          },
        ],
      }),
      buildSchedule({
        ids: { id: 'schedule-staff-2', orgId: 'org-1' },
        participants: [
          {
            ids: { id: 'child-22', orgId: 'org-1' },
            role: 'child',
            displayName: 'Staff Student Two',
          },
          {
            ids: { id: 'educator-22', orgId: 'org-1' },
            role: 'educator',
            displayName: 'Staff Tutor Two',
          },
        ],
      }),
    ]);
    getLearningSpacesByOrgMock.mockResolvedValue({
      data: [
        { id: 'space-1', status: 'active', title: 'Math Classroom', subject: 'Math' },
        {
          id: 'space-2',
          status: 'active',
          title: 'Science Classroom',
          subject: 'Science',
        },
      ],
    });
    getLearningSpaceParticipantsByLearningSpaceIdsMock.mockResolvedValue({ data: [] });

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: NOW,
      currentUserProfile: {
        kind: 'staff',
        ids: { id: 'staff-1', orgId: 'org-1', accountId: 'account-staff' },
      } as never,
    });

    expect(result.isStaffView).toBe(true);
    expect(result.metricsByRole.parents.upcomingSessionsThisWeek).toBe(6);
    expect(result.metricsByRole.parents.completedClassesThisMonth).toBe(6);
    expect(result.metricsByRole.parents.activeSubjectsCount).toBe(2);
    expect(result.metricsByRole.parents.activeSubjectsLabel).toBe('Manage classrooms');
    expect(result.calendarHref).toBe('/iconic-academy/admin/attendance/sessions');
    expect(result.notificationsHref).toBe('/iconic-academy/notifications');
    expect(result.browseHref).toBe('/iconic-academy/admin/channels');
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).toContain(
      'Staff Student One',
    );
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).toContain(
      'Staff Tutor One',
    );
  });

  it('returns full week sessions list with pagination metadata for client-side pagination', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([buildSchedule()]);
    getLearningSpacesByOrgMock.mockResolvedValue({
      data: [{ id: 'space-1', status: 'active', subject: 'Math' }],
    });
    getLearningSpaceParticipantsByLearningSpaceIdsMock.mockResolvedValue({
      data: [{ learning_space_id: 'space-1', profile_id: 'child-1' }],
    });

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: NOW,
      pageSize: 2,
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
      } as never,
    });

    expect(result.upcomingSessionsPage.thisWeek.total).toBe(3);
    expect(result.upcomingSessionsPage.thisWeek.totalPages).toBe(2);
    expect(result.upcomingSessionsPage.thisWeek.pageSize).toBe(2);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(3);
    expect(result.upcomingSessionsPage.nextWeek.total).toBe(5);
    expect(result.upcomingSessionsPage.nextWeek.totalPages).toBe(3);
    expect(result.upcomingSessionsPage.nextWeek.pageSize).toBe(2);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(5);
  });

  it('builds homepage upcoming-session labels in the viewer timezone without double conversion', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([
      buildSchedule({
        startAt: '2026-03-13T15:00:00.000Z',
        endAt: '2026-03-13T16:00:00.000Z',
      }),
    ]);
    getLearningSpacesByOrgMock.mockResolvedValue({
      data: [{ id: 'space-1', status: 'active', subject: 'Math' }],
    });
    getLearningSpaceParticipantsByLearningSpaceIdsMock.mockResolvedValue({
      data: [{ learning_space_id: 'space-1', profile_id: 'child-1' }],
    });

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: new Date('2026-03-13T12:00:00.000Z'),
      timezone: 'America/New_York',
      currentUserProfile: {
        kind: 'guardian',
        ids: { id: 'guardian-1', orgId: 'org-1', accountId: 'account-1' },
        prefs: { timezone: 'America/New_York' },
        children: {
          items: [
            {
              kind: 'child',
              ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
            },
          ],
        },
      } as never,
    });

    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).toContain(
      'Fri 11:00am EDT',
    );
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).not.toContain(
      '3:00pm UTC',
    );
  });

  it('renders homepage upcoming-session labels in the viewer timezone even for canonical class schedules', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([
      buildSchedule({
        startAt: '2026-03-13T20:00:00.000Z',
        endAt: '2026-03-13T21:00:00.000Z',
        timezone: 'America/New_York',
        recurrence: {
          ids: { id: 'rec-ny-1', orgId: 'org-1' },
          rule: {
            frequency: 'weekly',
            interval: 1,
            timezone: 'America/New_York',
          },
        },
      }),
    ]);
    getLearningSpacesByOrgMock.mockResolvedValue({
      data: [{ id: 'space-1', status: 'active', subject: 'Math' }],
    });
    getLearningSpaceParticipantsByLearningSpaceIdsMock.mockResolvedValue({
      data: [{ learning_space_id: 'space-1', profile_id: 'child-1' }],
    });

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: new Date('2026-03-13T12:00:00.000Z'),
      timezone: 'Asia/Colombo',
      currentUserProfile: {
        kind: 'guardian',
        ids: { id: 'guardian-1', orgId: 'org-1', accountId: 'account-1' },
        prefs: { timezone: 'Asia/Colombo' },
        children: {
          items: [
            {
              kind: 'child',
              ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
            },
          ],
        },
      } as never,
    });

    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).toContain(
      'Sat 1:30am GMT+5:30',
    );
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).not.toContain(
      '4:00pm EDT',
    );
  });

  it('marks homepage upcoming sessions for this week and next week separately', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([buildSchedule()]);
    getLearningSpacesByOrgMock.mockResolvedValue({
      data: [{ id: 'space-1', status: 'active', subject: 'Math' }],
    });
    getLearningSpaceParticipantsByLearningSpaceIdsMock.mockResolvedValue({
      data: [{ learning_space_id: 'space-1', profile_id: 'child-1' }],
    });

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: NOW,
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
      } as never,
    });

    expect(result.upcomingSessionsPage.thisWeek.items[0]?.weekBucket).toBe('this-week');
    expect(result.upcomingSessionsPage.nextWeek.items.at(-1)?.weekBucket).toBe(
      'next-week',
    );
  });
});
