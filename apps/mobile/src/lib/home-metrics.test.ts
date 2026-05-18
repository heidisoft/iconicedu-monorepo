import type { ClassScheduleVM } from '@iconicedu/shared-types';
import type { ClassSession } from '@/components/sessions/session-card';

import {
  buildHomeUpcomingSessions,
  buildHomeUpcomingSessionsMetricDisplay,
  buildHomeMetricSummary,
  splitHomeSessionsByTimeline,
  type LearningSpaceSummary,
} from './home-metrics';

const BASE_NOW = new Date('2026-03-23T12:00:00Z');

function makeSchedule(input: {
  id: string;
  learningSpaceId: string;
  startAt: string;
  endAt: string;
  participants: Array<{ id: string; role: 'child' | 'educator' }>;
  status?: ClassScheduleVM['status'];
}): ClassScheduleVM {
  return {
    ids: { id: input.id, orgId: 'org-1' },
    title: input.id,
    description: null,
    location: null,
    meetingLink: null,
    startAt: input.startAt,
    endAt: input.endAt,
    timezone: null,
    status: input.status ?? 'scheduled',
    visibility: 'private',
    themeKey: null,
    source: {
      kind: 'class_session',
      learningSpaceId: input.learningSpaceId,
      channelId: `${input.id}-channel`,
    },
    participants: input.participants.map((participant) => ({
      ids: { id: participant.id, orgId: 'org-1' },
      role: participant.role,
      status: 'accepted',
      displayName: participant.id,
      avatarUrl: null,
      themeKey: null,
    })),
    recurrence: undefined,
  };
}

const LEARNING_SPACES: LearningSpaceSummary[] = [
  { id: 'space-math', status: 'active', subject: 'Math', title: 'Math' },
  { id: 'space-science', status: 'active', subject: 'Science', title: 'Science' },
];

function makeSession(input: {
  id: string;
  startAt?: string;
  endAt?: string;
  isToday?: boolean;
  status?: ClassSession['status'];
}): ClassSession {
  return {
    id: input.id,
    label: input.id,
    time: '9:00 AM',
    participantLabel: null,
    participants: [],
    dayName: 'Mon',
    dayNum: '23',
    isToday: input.isToday ?? false,
    isLive: false,
    isPast: false,
    status: input.status ?? 'scheduled',
    meetingLink: null,
    channelId: null,
    students: [],
    variant: 'default',
    disabled: false,
    reason: null,
    originalTime: null,
    originalDate: null,
    startAt: input.startAt ?? '2026-03-30T16:00:00Z',
    endAt: input.endAt ?? '2026-03-30T17:00:00Z',
  };
}

describe('buildHomeMetricSummary', () => {
  it('builds child metrics with active subjects', () => {
    const result = buildHomeMetricSummary({
      schedules: [
        makeSchedule({
          id: 'upcoming',
          learningSpaceId: 'space-math',
          startAt: '2026-03-24T14:00:00Z',
          endAt: '2026-03-24T15:00:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
        makeSchedule({
          id: 'completed',
          learningSpaceId: 'space-science',
          startAt: '2026-03-05T14:00:00Z',
          endAt: '2026-03-05T15:00:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
      ],
      learningSpaces: LEARNING_SPACES,
      profileKind: 'child',
      profileId: 'child-1',
      now: BASE_NOW,
    });

    expect(result).toEqual({
      upcomingSessionsThisWeek: 1,
      completedClassesThisMonth: 1,
      thirdMetricTitle: 'Active Subjects',
      thirdMetricValue: 2,
      thirdMetricLabel: 'Math, Science',
    });
  });

  it('excludes cancelled upcoming sessions from the weekly homepage metric', () => {
    const result = buildHomeMetricSummary({
      schedules: [
        makeSchedule({
          id: 'scheduled-upcoming',
          learningSpaceId: 'space-math',
          startAt: '2026-03-24T14:00:00Z',
          endAt: '2026-03-24T15:00:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
        makeSchedule({
          id: 'cancelled-upcoming',
          learningSpaceId: 'space-math',
          startAt: '2026-03-25T14:00:00Z',
          endAt: '2026-03-25T15:00:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
          status: 'cancelled',
        }),
      ],
      learningSpaces: LEARNING_SPACES,
      profileKind: 'child',
      profileId: 'child-1',
      now: BASE_NOW,
    });

    expect(result.upcomingSessionsThisWeek).toBe(1);
  });

  it('shows next week count when the weekly homepage metric is zero', () => {
    expect(
      buildHomeUpcomingSessionsMetricDisplay({
        upcomingSessionsThisWeek: 0,
        nextWeekSessions: [
          makeSession({ id: 'next-week-1', status: 'scheduled' }),
          makeSession({ id: 'next-week-2', status: 'cancelled' }),
          makeSession({ id: 'next-week-3', status: 'scheduled' }),
        ],
      }),
    ).toEqual({
      value: 2,
      label: 'Next week',
    });
  });

  it('keeps this week count when the weekly homepage metric is nonzero', () => {
    expect(
      buildHomeUpcomingSessionsMetricDisplay({
        upcomingSessionsThisWeek: 1,
        nextWeekSessions: [makeSession({ id: 'next-week-1', status: 'scheduled' })],
      }),
    ).toEqual({
      value: 1,
      label: 'This week',
    });
  });

  it('builds educator metrics with active students', () => {
    const result = buildHomeMetricSummary({
      schedules: [
        makeSchedule({
          id: 'educator-schedule',
          learningSpaceId: 'space-math',
          startAt: '2026-03-24T14:00:00Z',
          endAt: '2026-03-24T15:00:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'child-2', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
      ],
      learningSpaces: LEARNING_SPACES,
      profileKind: 'educator',
      profileId: 'teacher-1',
      now: BASE_NOW,
    });

    expect(result.thirdMetricTitle).toBe('Active Students');
    expect(result.thirdMetricValue).toBe(2);
    expect(result.thirdMetricLabel).toBe('2 active students');
  });

  it('builds staff metrics with classroom count', () => {
    const result = buildHomeMetricSummary({
      schedules: [],
      learningSpaces: LEARNING_SPACES,
      profileKind: 'staff',
      now: BASE_NOW,
    });

    expect(result.thirdMetricTitle).toBe('Manage Classrooms');
    expect(result.thirdMetricValue).toBe(2);
    expect(result.thirdMetricLabel).toBe('Manage classrooms');
  });

  it('splits upcoming sessions into today, this week, and next week buckets', () => {
    const result = splitHomeSessionsByTimeline({
      now: BASE_NOW,
      sessions: [
        makeSession({
          id: 'today-session',
          startAt: '2026-03-23T16:00:00Z',
          endAt: '2026-03-23T17:00:00Z',
          isToday: true,
        }),
        makeSession({
          id: 'this-week-session',
          startAt: '2026-03-25T16:00:00Z',
          endAt: '2026-03-25T17:00:00Z',
        }),
        makeSession({
          id: 'next-week-session',
          startAt: '2026-03-31T16:00:00Z',
          endAt: '2026-03-31T17:00:00Z',
        }),
      ],
    });

    expect(result.today.map((session) => session.id)).toEqual(['today-session']);
    expect(result.thisWeek.map((session) => session.id)).toEqual(['this-week-session']);
    expect(result.nextWeek.map((session) => session.id)).toEqual(['next-week-session']);
  });

  it('uses monday-based week buckets like the web homepage', () => {
    const result = splitHomeSessionsByTimeline({
      now: new Date('2026-03-08T23:30:00.000Z'),
      timezone: 'America/Los_Angeles',
      sessions: [
        makeSession({
          id: 'today-session',
          startAt: '2026-03-09T00:30:00.000Z',
          endAt: '2026-03-09T01:30:00.000Z',
          isToday: true,
        }),
      ],
    });

    expect(result.today.map((session) => session.id)).toEqual(['today-session']);
    expect(result.thisWeek).toHaveLength(0);
    expect(result.nextWeek).toHaveLength(0);
  });

  it('builds upcoming homepage sessions with the same timezone-aware weekly boundaries as web', () => {
    const result = buildHomeUpcomingSessions({
      schedules: [
        makeSchedule({
          id: 'metric-alignment',
          learningSpaceId: 'space-math',
          startAt: '2026-03-09T00:30:00.000Z',
          endAt: '2026-03-09T01:30:00.000Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
      ],
      profileKind: 'child',
      profileId: 'child-1',
      now: new Date('2026-03-08T23:30:00.000Z'),
      timezone: 'America/Los_Angeles',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.isToday).toBe(true);
  });

  it('counts a Sunday session this week when loaded on Sunday before the session', () => {
    const result = buildHomeMetricSummary({
      schedules: [
        makeSchedule({
          id: 'sunday-session',
          learningSpaceId: 'space-math',
          startAt: '2026-05-17T19:00:00Z',
          endAt: '2026-05-17T20:00:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
      ],
      learningSpaces: LEARNING_SPACES,
      profileKind: 'child',
      profileId: 'child-1',
      now: new Date('2026-05-17T13:00:00Z'),
      timezone: 'America/New_York',
    });

    expect(result.upcomingSessionsThisWeek).toBe(1);
  });

  it('does not count a past-week Sunday session when the viewer is early Monday in their timezone', () => {
    const result = buildHomeMetricSummary({
      schedules: [
        makeSchedule({
          id: 'sunday-session',
          learningSpaceId: 'space-math',
          startAt: '2026-05-17T19:00:00Z',
          endAt: '2026-05-18T05:30:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
      ],
      learningSpaces: LEARNING_SPACES,
      profileKind: 'child',
      profileId: 'child-1',
      now: new Date('2026-05-18T04:30:00Z'),
      timezone: 'America/New_York',
    });

    // It is now Monday in the viewer's timezone; the Sunday session is from last week
    expect(result.upcomingSessionsThisWeek).toBe(0);
  });
});

describe('buildHomeUpcomingSessions', () => {
  it('includes both tutor and student names for child homepage session tiles', () => {
    const result = buildHomeUpcomingSessions({
      schedules: [
        makeSchedule({
          id: 'child-session',
          learningSpaceId: 'space-math',
          startAt: '2026-03-24T14:00:00Z',
          endAt: '2026-03-24T15:00:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
      ],
      profileKind: 'child',
      profileId: 'child-1',
      now: BASE_NOW,
    });

    expect(result[0]?.participants?.map((participant) => participant.name)).toEqual([
      'child-1',
      'teacher-1',
    ]);
  });

  it('includes both tutor and student names for educator homepage session tiles', () => {
    const result = buildHomeUpcomingSessions({
      schedules: [
        makeSchedule({
          id: 'educator-session',
          learningSpaceId: 'space-math',
          startAt: '2026-03-24T14:00:00Z',
          endAt: '2026-03-24T15:00:00Z',
          participants: [
            { id: 'child-1', role: 'child' },
            { id: 'teacher-1', role: 'educator' },
          ],
        }),
      ],
      profileKind: 'educator',
      profileId: 'teacher-1',
      now: BASE_NOW,
    });

    expect(result[0]?.participants?.map((participant) => participant.name)).toEqual([
      'child-1',
      'teacher-1',
    ]);
  });
});
