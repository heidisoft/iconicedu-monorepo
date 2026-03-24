import type { ClassScheduleVM } from '@iconicedu/shared-types';

import { buildHomeMetricSummary, type LearningSpaceSummary } from './home-metrics';

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
});
