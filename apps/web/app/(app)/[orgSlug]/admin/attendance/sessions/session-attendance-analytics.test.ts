import { describe, expect, it } from 'vitest';
import type { AdminSessionCompletionVM } from '@iconicedu/shared-types';
import {
  buildConfirmerBreakdown,
  buildMonthFilterHref,
  buildMonthlyCompletionTrend,
  buildRecentCompletionMonthKeys,
  completionMonthKeyToUtcRange,
  filterCompletions,
  getCurrentCompletionMonthKey,
  isCompletionMonthKey,
  summarizeCompletions,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-analytics';

function completion(
  overrides: Partial<AdminSessionCompletionVM> = {},
): AdminSessionCompletionVM {
  return {
    id: 'schedule-1|2026-03-10T14:00:00.000Z',
    orgId: 'org-1',
    scheduleId: 'schedule-1',
    occurrenceKey: '2026-03-10T14:00:00.000Z',
    sessionEndAt: '2026-03-10T15:00:00.000Z',
    sessionTitle: 'Algebra tutoring',
    studentNames: ['Jamie Lee'],
    channelId: 'channel-1',
    learningSpaceId: 'space-1',
    learningSpaceTitle: 'Room A',
    completedAt: '2026-03-10T15:05:00.000Z',
    completionMethod: 'confirmed',
    averageRating: 4,
    guardians: [{ profileId: 'parent-1', displayName: 'Morgan Lee' }],
    confirmedBy: [
      {
        profileId: 'teacher-1',
        displayName: 'Taylor Reed',
        role: 'educator',
        status: 'confirmed',
        completedAt: '2026-03-10T15:05:00.000Z',
      },
      {
        profileId: 'parent-1',
        displayName: 'Morgan Lee',
        role: 'guardian',
        status: 'confirmed',
        completedAt: '2026-03-10T15:03:00.000Z',
      },
    ],
    ...overrides,
  };
}

// Every filter set to its "no-op" value, so a test can override just one.
const ALL = {
  search: '',
  month: 'all',
  classroomId: 'all',
  teacherId: 'all',
  parentId: 'all',
  studentName: 'all',
  method: 'all',
};

describe('completed session analytics', () => {
  it('summarizes unique completed occurrences by confirmer role', () => {
    expect(summarizeCompletions([completion()])).toEqual({
      completedSessions: 1,
      teacherConfirmed: 1,
      parentConfirmed: 1,
      averageRating: 4,
    });
  });

  it('filters by month, classroom, teacher, parent, method, and search', () => {
    const result = filterCompletions(
      [
        completion(),
        completion({ id: 'other', sessionEndAt: '2026-02-01T10:00:00.000Z' }),
      ],
      {
        search: 'Jamie',
        month: '2026-03',
        classroomId: 'space-1',
        teacherId: 'teacher-1',
        parentId: 'parent-1',
        studentName: 'Jamie Lee',
        method: 'confirmed',
      },
    );
    expect(result.map((row) => row.id)).toEqual(['schedule-1|2026-03-10T14:00:00.000Z']);
  });

  it('drops rows outside the selected classroom', () => {
    const result = filterCompletions(
      [completion(), completion({ id: 'other', learningSpaceId: 'space-2' })],
      { ...ALL, classroomId: 'space-1' },
    );
    expect(result.map((row) => row.id)).toEqual(['schedule-1|2026-03-10T14:00:00.000Z']);
  });

  it('scopes the parent filter to the schedule roster, not the confirmer', () => {
    // Session the parent is a guardian on, but only the teacher confirmed.
    const teacherOnly = completion({
      id: 'teacher-only',
      confirmedBy: [
        {
          profileId: 'teacher-1',
          displayName: 'Taylor Reed',
          role: 'educator',
          status: 'confirmed',
          completedAt: '2026-03-10T15:05:00.000Z',
        },
      ],
    });
    // Different kid, different parent — must not match.
    const otherFamily = completion({
      id: 'other-family',
      guardians: [{ profileId: 'parent-2', displayName: 'Alex Kim' }],
    });
    const result = filterCompletions([teacherOnly, otherFamily], {
      ...ALL,
      parentId: 'parent-1',
    });
    expect(result.map((row) => row.id)).toEqual(['teacher-only']);
  });

  it('derives the current UTC month key and a descending recent-month window', () => {
    const reference = new Date('2026-09-07T12:00:00.000Z');
    expect(getCurrentCompletionMonthKey(reference)).toBe('2026-09');
    expect(buildRecentCompletionMonthKeys(4, reference)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-06',
    ]);
  });

  it('maps a month key to a half-open UTC range and rejects non-keys', () => {
    expect(completionMonthKeyToUtcRange('2026-09')).toEqual({
      since: '2026-09-01T00:00:00.000Z',
      until: '2026-10-01T00:00:00.000Z',
    });
    expect(completionMonthKeyToUtcRange('all')).toBeNull();
    expect(completionMonthKeyToUtcRange('2026-13')).toBeNull();
    expect(isCompletionMonthKey('2026-09')).toBe(true);
    expect(isCompletionMonthKey('all')).toBe(false);
  });

  it('builds a month-filter href, leaving the three-month window implicit', () => {
    const base = '/i/admin/attendance/sessions';
    expect(buildMonthFilterHref(base, '', '2026-07')).toBe(`${base}?month=2026-07`);
    expect(buildMonthFilterHref(base, 'month=2026-07', 'all')).toBe(base);
    // Selecting a single month keeps it explicit in the URL.
    expect(buildMonthFilterHref(base, 'month=2026-07', '2026-09')).toBe(
      `${base}?month=2026-09`,
    );
  });

  it('builds chronological monthly and confirmer breakdowns', () => {
    const rows = [
      completion(),
      completion({ id: 'other', sessionEndAt: '2026-02-01T10:00:00.000Z' }),
    ];
    expect(buildMonthlyCompletionTrend(rows).map((point) => point.key)).toEqual([
      '2026-02',
      '2026-03',
    ]);
    expect(buildConfirmerBreakdown(rows, 'educator')[0]).toMatchObject({
      name: 'Taylor Reed',
      sessions: 2,
    });
    expect(buildConfirmerBreakdown(rows, 'guardian')[0]).toMatchObject({
      name: 'Morgan Lee',
      sessions: 2,
    });
  });
});

it('counts pending and automatic confirmations in each person’s total but only manual confirmations in the numerator', () => {
  const row = completion();
  const participants = row.confirmedBy.map((actor) => ({
    ...actor,
    role: actor.role as 'educator' | 'guardian',
  }));
  const rows = [
    completion({ participants }),
    completion({
      id: 'pending',
      confirmedBy: [],
      participants: participants.map((actor) => ({ ...actor, status: 'pending' })),
    }),
    completion({
      id: 'automatic',
      confirmedBy: row.confirmedBy.map((actor) => ({
        ...actor,
        status: 'auto_confirmed',
      })),
      participants: participants.map((actor) => ({ ...actor, status: 'auto_confirmed' })),
    }),
  ];
  for (const role of ['educator', 'guardian'] as const) {
    expect(buildConfirmerBreakdown(rows, role)[0]).toMatchObject({
      sessions: 1,
      total: 3,
      percentage: 33,
    });
  }
  expect(summarizeCompletions(rows)).toMatchObject({
    completedSessions: 3,
    teacherConfirmed: 1,
    parentConfirmed: 1,
  });
  expect(filterCompletions(rows, { ...ALL, teacherId: 'teacher-1' })).toHaveLength(3);
  expect(buildConfirmerBreakdown([], 'educator')).toEqual([]);
});

it('includes people with no confirmations and deduplicates people within an occurrence', () => {
  const person = {
    profileId: 'tutor',
    displayName: 'Tutor',
    role: 'educator' as const,
    status: 'pending' as const,
  };
  expect(
    buildConfirmerBreakdown([completion({ participants: [person, person] })], 'educator'),
  ).toEqual([{ id: 'tutor', name: 'Tutor', sessions: 0, total: 1, percentage: 0 }]);
});
