import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGetMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: () => ({
    get: apiGetMock,
  }),
}));

import { buildDashboardHomeInfographicMetrics } from '@iconicedu/web/lib/dashboard/home-infographic-metrics';

const NOW = new Date('2026-03-13T12:00:00.000Z');

type RawParticipant = {
  profile_id: string;
  org_id?: string;
  role: string;
  status?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  theme_key?: string | null;
};

type RawRecurrence = {
  id: string;
  org_id?: string;
  frequency: string;
  interval?: number | null;
  count?: number | null;
  until?: string | null;
  timezone?: string | null;
  byday?: string[] | null;
  exceptions?: Array<{ occurrence_key: string; reason?: string | null }>;
  overrides?: Array<{ occurrence_key: string; patch: Record<string, unknown> }>;
};

type RawScheduleRow = Record<string, unknown>;

function buildRawSchedule(overrides?: Partial<RawScheduleRow>): RawScheduleRow {
  return {
    id: 'schedule-1',
    org_id: 'org-1',
    title: 'Algebra Daily',
    description: null,
    location: null,
    meeting_link: null,
    start_at: '2026-03-10T15:00:00.000Z',
    end_at: '2026-03-10T16:00:00.000Z',
    timezone: 'UTC',
    status: 'scheduled',
    visibility: 'internal',
    theme_key: null,
    source_kind: 'class_session',
    source_learning_space_id: 'space-1',
    source_channel_id: 'channel-1',
    source_session_id: null,
    source_learning_space: null,
    participants: [
      {
        profile_id: 'child-1',
        org_id: 'org-1',
        role: 'child',
        status: 'accepted',
        display_name: 'Student One',
        avatar_url: null,
        theme_key: null,
      },
      {
        profile_id: 'educator-1',
        org_id: 'org-1',
        role: 'educator',
        status: 'accepted',
        display_name: 'Tutor Jane',
        avatar_url: null,
        theme_key: null,
      },
    ] satisfies RawParticipant[],
    recurrence: [
      {
        id: 'rec-1',
        org_id: 'org-1',
        frequency: 'daily',
        interval: 1,
        count: null,
        until: '2026-03-20T15:00:00.000Z',
        timezone: 'UTC',
        byday: null,
        exceptions: [],
        overrides: [],
      },
    ] satisfies RawRecurrence[],
    created_at: '2026-03-01T00:00:00.000Z',
    created_by: 'staff-1',
    updated_at: null,
    updated_by: null,
    ...overrides,
  };
}

function buildRawWeeklyRecurringSchedule(
  overrides?: Partial<RawScheduleRow>,
): RawScheduleRow {
  return buildRawSchedule({
    id: 'schedule-weekly',
    start_at: '2026-03-02T15:00:00.000Z',
    end_at: '2026-03-02T16:00:00.000Z',
    recurrence: [
      {
        id: 'rec-weekly-1',
        org_id: 'org-1',
        frequency: 'weekly',
        interval: 1,
        count: null,
        until: '2026-03-31T23:59:59.000Z',
        timezone: 'UTC',
        byday: ['MO', 'WE'],
        exceptions: [{ occurrence_key: '2026-03-04T15:00:00.000Z', reason: 'Cancelled' }],
        overrides: [
          {
            occurrence_key: '2026-03-09T15:00:00.000Z',
            patch: {
              startAt: '2026-03-11T17:00:00.000Z',
              endAt: '2026-03-11T18:00:00.000Z',
            },
          },
          {
            occurrence_key: '2026-03-16T15:00:00.000Z',
            patch: {
              startAt: '2026-04-01T15:00:00.000Z',
              endAt: '2026-04-01T16:00:00.000Z',
            },
          },
        ],
      },
    ] satisfies RawRecurrence[],
    ...overrides,
  });
}

function mockApi(schedules: RawScheduleRow[], spaces: Record<string, unknown>[]) {
  apiGetMock.mockImplementation((path: string) => {
    if (path === '/schedules') return Promise.resolve(schedules);
    if (path === '/spaces') return Promise.resolve(spaces);
    return Promise.resolve([]);
  });
}

describe('buildDashboardHomeInfographicMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds guardian metrics from linked child participation and zeros other tabs', async () => {
    mockApi(
      [
        buildRawSchedule(),
        buildRawSchedule({
          id: 'schedule-space-2',
          source_learning_space_id: 'space-2',
          participants: [
            {
              profile_id: 'child-1',
              org_id: 'org-1',
              role: 'child',
              status: 'accepted',
              display_name: 'Student One',
              avatar_url: null,
              theme_key: null,
            },
          ],
          recurrence: null,
          start_at: '2026-03-13T16:00:00.000Z',
          end_at: '2026-03-13T17:00:00.000Z',
        }),
      ],
      [
        { id: 'space-1', status: 'active', subject: 'Math', title: null },
        { id: 'space-2', status: 'active', subject: 'Science', title: null },
        { id: 'space-3', status: 'archived', subject: 'History', title: null },
      ],
    );

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
    expect(result.browseHref).toBe('/iconic-academy/s');
    expect(result.metricsByRole.parents).toEqual({
      upcomingSessionsThisWeek: 4,
      completedClassesThisMonth: 3,
      activeSubjectsCount: 2,
      activeSubjectsLabel: 'Math, Science',
    });
    expect(result.upcomingSessionsPage.today.items.length).toBeGreaterThanOrEqual(1);
    expect(result.upcomingSessionsPage.today.items[0]).toMatchObject({
      session: { label: 'Algebra Daily' },
      joinHref: '/iconic-academy/s/channel-1',
      weekBucket: 'today',
    });
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).toContain(
      'Student One',
    );
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).toContain(
      'Tutor Jane',
    );
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
    mockApi(
      [
        buildRawSchedule(),
        buildRawSchedule({
          id: 'schedule-2',
          participants: [
            {
              profile_id: 'child-2',
              org_id: 'org-1',
              role: 'child',
              status: 'accepted',
              display_name: null,
              avatar_url: null,
              theme_key: null,
            },
          ],
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

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
    expect(result.upcomingSessionsPage.today.items).toHaveLength(1);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(2);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(5);
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).toContain(
      'Tutor Jane',
    );
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).not.toContain(
      'Student One',
    );
    expect(result.metricsByRole.parents.upcomingSessionsThisWeek).toBe(0);
    expect(result.metricsByRole.tutors.upcomingSessionsThisWeek).toBe(0);
  });

  it('builds tutor metrics from educator profile scope', async () => {
    mockApi(
      [
        buildRawSchedule({
          participants: [
            {
              profile_id: 'educator-1',
              org_id: 'org-1',
              role: 'educator',
              status: 'accepted',
              display_name: 'Tutor Jane',
              avatar_url: null,
              theme_key: null,
            },
            {
              profile_id: 'child-9',
              org_id: 'org-1',
              role: 'child',
              status: 'accepted',
              display_name: 'Student Nine',
              avatar_url: null,
              theme_key: null,
            },
          ],
        }),
        buildRawSchedule({
          id: 'schedule-manual',
          source_kind: 'manual',
          source_learning_space_id: null,
          source_channel_id: null,
          participants: [
            {
              profile_id: 'educator-1',
              org_id: 'org-1',
              role: 'educator',
              status: 'accepted',
              display_name: 'Tutor Jane',
              avatar_url: null,
              theme_key: null,
            },
          ],
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'English', title: null }],
    );

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
      activeSubjectsLabel: '1 active student',
    });
    expect(result.upcomingSessionsPage.today.items).toHaveLength(1);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(2);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(5);
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).toContain(
      'Student Nine',
    );
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).not.toContain(
      'Tutor Jane',
    );
    expect(result.metricsByRole.parents.activeSubjectsCount).toBe(0);
    expect(result.metricsByRole.students.activeSubjectsCount).toBe(0);
  });

  it('builds staff metrics with organization-wide classroom totals and management links', async () => {
    mockApi(
      [
        buildRawSchedule({
          id: 'schedule-staff-1',
          source_learning_space_id: 'space-1',
          participants: [
            {
              profile_id: 'child-11',
              org_id: 'org-1',
              role: 'child',
              status: 'accepted',
              display_name: 'Staff Student One',
              avatar_url: null,
              theme_key: null,
            },
            {
              profile_id: 'educator-11',
              org_id: 'org-1',
              role: 'educator',
              status: 'accepted',
              display_name: 'Staff Tutor One',
              avatar_url: null,
              theme_key: null,
            },
          ],
        }),
        buildRawSchedule({
          id: 'schedule-staff-2',
          source_learning_space_id: 'space-2',
          participants: [
            {
              profile_id: 'child-22',
              org_id: 'org-1',
              role: 'child',
              status: 'accepted',
              display_name: 'Staff Student Two',
              avatar_url: null,
              theme_key: null,
            },
            {
              profile_id: 'educator-22',
              org_id: 'org-1',
              role: 'educator',
              status: 'accepted',
              display_name: 'Staff Tutor Two',
              avatar_url: null,
              theme_key: null,
            },
          ],
        }),
      ],
      [
        { id: 'space-1', status: 'active', subject: 'Math', title: 'Math Classroom' },
        {
          id: 'space-2',
          status: 'active',
          subject: 'Science',
          title: 'Science Classroom',
        },
      ],
    );

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
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).toContain(
      'Staff Student One',
    );
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).toContain(
      'Staff Tutor One',
    );
  });

  it('returns full week sessions list with pagination metadata for client-side pagination', async () => {
    mockApi(
      [buildRawSchedule()],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

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

    expect(result.upcomingSessionsPage.today.total).toBe(1);
    expect(result.upcomingSessionsPage.today.totalPages).toBe(1);
    expect(result.upcomingSessionsPage.today.pageSize).toBe(2);
    expect(result.upcomingSessionsPage.today.items).toHaveLength(1);
    expect(result.upcomingSessionsPage.thisWeek.total).toBe(2);
    expect(result.upcomingSessionsPage.thisWeek.totalPages).toBe(1);
    expect(result.upcomingSessionsPage.thisWeek.pageSize).toBe(2);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(2);
    expect(result.upcomingSessionsPage.nextWeek.total).toBe(5);
    expect(result.upcomingSessionsPage.nextWeek.totalPages).toBe(3);
    expect(result.upcomingSessionsPage.nextWeek.pageSize).toBe(2);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(5);
  });

  it('builds homepage upcoming-session labels in the viewer timezone without double conversion', async () => {
    mockApi(
      [
        buildRawSchedule({
          start_at: '2026-03-13T15:00:00.000Z',
          end_at: '2026-03-13T16:00:00.000Z',
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

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

    expect(result.upcomingSessionsPage.today.items[0]?.session.time).toContain(
      'Fri 11:00am New York time',
    );
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).not.toContain(
      '3:00pm UTC',
    );
  });

  it('renders homepage upcoming-session labels in the viewer timezone even for canonical class schedules', async () => {
    mockApi(
      [
        buildRawSchedule({
          start_at: '2026-03-13T20:00:00.000Z',
          end_at: '2026-03-13T21:00:00.000Z',
          timezone: 'America/New_York',
          recurrence: [
            {
              id: 'rec-ny-1',
              org_id: 'org-1',
              frequency: 'weekly',
              interval: 1,
              count: null,
              until: null,
              timezone: 'America/New_York',
              byday: null,
              exceptions: [],
              overrides: [],
            },
          ],
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

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
      'Sat 1:30am Sri Lanka time',
    );
    expect(result.upcomingSessionsPage.thisWeek.items[0]?.session.time).not.toContain(
      '4:00pm New York time',
    );
  });

  it('marks homepage upcoming sessions for this week and next week separately', async () => {
    mockApi(
      [buildRawSchedule()],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

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

    expect(result.upcomingSessionsPage.today.items[0]?.weekBucket).toBe('today');
    expect(result.upcomingSessionsPage.nextWeek.items.at(-1)?.weekBucket).toBe(
      'next-week',
    );
  });

  it('uses the viewer timezone for dashboard week buckets near UTC week boundaries', async () => {
    mockApi(
      [
        buildRawSchedule({
          id: 'week-boundary',
          start_at: '2026-03-09T00:30:00.000Z',
          end_at: '2026-03-09T01:30:00.000Z',
          recurrence: null,
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: new Date('2026-03-08T23:30:00.000Z'),
      timezone: 'America/Los_Angeles',
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
        prefs: { timezone: 'America/Los_Angeles' },
      } as never,
    });

    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(1);
    expect(result.upcomingSessionsPage.today.items).toHaveLength(1);
    expect(result.upcomingSessionsPage.today.items[0]?.weekBucket).toBe('today');
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(0);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(0);
    expect(result.upcomingSessionsPage.today.items[0]?.session.time).toContain(
      'Sun 5:30pm Los Angeles time',
    );
  });

  it('keeps the homepage upcoming metric aligned with the visible today and this-week buckets', async () => {
    mockApi(
      [
        buildRawSchedule({
          id: 'metric-alignment',
          start_at: '2026-03-09T00:30:00.000Z',
          end_at: '2026-03-09T01:30:00.000Z',
          recurrence: null,
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: new Date('2026-03-08T23:30:00.000Z'),
      timezone: 'America/Los_Angeles',
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
        prefs: { timezone: 'America/Los_Angeles' },
      } as never,
    });

    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(
      result.upcomingSessionsPage.today.total +
        result.upcomingSessionsPage.thisWeek.total,
    );
    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(1);
  });

  it('excludes cancelled upcoming sessions from the homepage tile metric', async () => {
    mockApi(
      [
        buildRawSchedule({ id: 'scheduled-session' }),
        buildRawSchedule({
          id: 'cancelled-session',
          start_at: '2026-03-12T15:00:00.000Z',
          end_at: '2026-03-12T16:00:00.000Z',
          status: 'cancelled',
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

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

    const visibleThisWeekTotal =
      result.upcomingSessionsPage.today.total +
      result.upcomingSessionsPage.thisWeek.total;

    expect(
      result.upcomingSessionsPage.today.items.some(
        (item) => item.session.status === 'cancelled',
      ),
    ).toBe(true);
    expect(
      result.upcomingSessionsPage.thisWeek.items.some(
        (item) => item.session.status === 'cancelled',
      ),
    ).toBe(true);
    expect(visibleThisWeekTotal).toBe(6);
    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(3);
  });

  it('counts recurring multi-day sessions separately while excluding cancelled and moved-out occurrences', async () => {
    mockApi(
      [buildRawWeeklyRecurringSchedule()],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: new Date('2026-03-10T12:00:00.000Z'),
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
      } as never,
    });

    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(2);
    expect(result.metricsByRole.students.completedClassesThisMonth).toBe(1);
    expect(result.upcomingSessionsPage.thisWeek.total).toBe(2);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(2);
    expect(
      result.upcomingSessionsPage.thisWeek.items.every(
        (item) => item.session.dayNum === '11',
      ),
    ).toBe(true);
  });

  it('counts a Sunday session this week when the server is loaded on Sunday before the session', async () => {
    mockApi(
      [
        buildRawSchedule({
          id: 'sunday-session',
          start_at: '2026-05-17T19:00:00.000Z',
          end_at: '2026-05-17T20:00:00.000Z',
          recurrence: null,
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: new Date('2026-05-17T13:00:00.000Z'),
      timezone: 'America/New_York',
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
        prefs: { timezone: 'America/New_York' },
      } as never,
    });

    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(1);
    expect(result.upcomingSessionsPage.today.items).toHaveLength(1);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(0);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(0);
  });

  it('does not count a past-week Sunday session as next-week when the viewer is early Monday in their timezone', async () => {
    mockApi(
      [
        buildRawSchedule({
          id: 'sunday-session',
          start_at: '2026-05-17T19:00:00.000Z',
          end_at: '2026-05-18T05:30:00.000Z',
          recurrence: null,
        }),
      ],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

    // now = Monday 12:30am EDT (4:30am UTC) — viewer is in the new week but UTC was already Monday
    const result = await buildDashboardHomeInfographicMetrics({
      supabase: {} as never,
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      now: new Date('2026-05-18T04:30:00.000Z'),
      timezone: 'America/New_York',
      currentUserProfile: {
        kind: 'child',
        ids: { id: 'child-1', orgId: 'org-1', accountId: 'account-c1' },
        prefs: { timezone: 'America/New_York' },
      } as never,
    });

    // The Sunday session belongs to the previous week and must not appear in any upcoming bucket
    expect(result.upcomingSessionsPage.today.items).toHaveLength(0);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(0);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(0);
    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(0);
  });

  it('counts upcoming one-off and replacement recurring rules after an older rule ended', async () => {
    const endedRule = buildRawSchedule({
      id: 'ended-daily-rule',
      start_at: '2026-03-09T15:00:00.000Z',
      end_at: '2026-03-09T16:00:00.000Z',
      recurrence: [
        {
          id: 'rec-ended-daily',
          org_id: 'org-1',
          frequency: 'daily',
          interval: 1,
          count: null,
          until: '2026-03-12T23:59:59.000Z',
          timezone: 'UTC',
          byday: null,
          exceptions: [],
          overrides: [],
        },
      ] satisfies RawRecurrence[],
    });

    const replacementRules = [
      buildRawSchedule({
        id: 'replacement-weekly-rule',
        start_at: '2026-03-11T17:00:00.000Z',
        end_at: '2026-03-11T18:00:00.000Z',
        recurrence: [
          {
            id: 'rec-replacement-weekly',
            org_id: 'org-1',
            frequency: 'weekly',
            interval: 1,
            count: null,
            until: null,
            timezone: 'UTC',
            byday: ['WE', 'FR'],
            exceptions: [],
            overrides: [],
          },
        ] satisfies RawRecurrence[],
      }),
      buildRawSchedule({
        id: 'one-off-this-week',
        start_at: '2026-03-14T15:00:00.000Z',
        end_at: '2026-03-14T16:00:00.000Z',
        recurrence: null,
      }),
    ];

    mockApi(
      [endedRule, ...replacementRules],
      [{ id: 'space-1', status: 'active', subject: 'Math', title: null }],
    );

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

    expect(result.metricsByRole.students.upcomingSessionsThisWeek).toBe(2);
    expect(result.upcomingSessionsPage.today.items).toHaveLength(1);
    expect(result.upcomingSessionsPage.thisWeek.items).toHaveLength(1);
    expect(result.upcomingSessionsPage.nextWeek.items).toHaveLength(2);
    expect(
      result.upcomingSessionsPage.today.items.some((item) =>
        item.session.id.includes('ended-daily-rule'),
      ),
    ).toBe(false);
    expect(
      result.upcomingSessionsPage.today.items.some((item) =>
        item.session.id.includes('replacement-weekly-rule'),
      ),
    ).toBe(true);
  });
});
