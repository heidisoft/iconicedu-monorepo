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
    completedAt: '2026-03-10T15:05:00.000Z',
    completionMethod: 'confirmed',
    averageRating: 4,
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

describe('completed session analytics', () => {
  it('summarizes unique completed occurrences by confirmer role', () => {
    expect(summarizeCompletions([completion()])).toEqual({
      completedSessions: 1,
      teacherConfirmed: 1,
      parentConfirmed: 1,
      averageRating: 4,
    });
  });

  it('filters by month, teacher, parent, method, and search', () => {
    const result = filterCompletions(
      [
        completion(),
        completion({ id: 'other', sessionEndAt: '2026-02-01T10:00:00.000Z' }),
      ],
      {
        search: 'Jamie',
        month: '2026-03',
        teacherId: 'teacher-1',
        parentId: 'parent-1',
        studentName: 'Jamie Lee',
        method: 'confirmed',
      },
    );
    expect(result.map((row) => row.id)).toEqual(['schedule-1|2026-03-10T14:00:00.000Z']);
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

  it('builds a month-filter href, leaving the current month implicit', () => {
    const now = new Date('2026-09-07T12:00:00.000Z');
    const base = '/i/admin/attendance/sessions';
    expect(buildMonthFilterHref(base, '', '2026-07', now)).toBe(`${base}?month=2026-07`);
    expect(buildMonthFilterHref(base, 'month=2026-07', 'all', now)).toBe(
      `${base}?month=all`,
    );
    // Selecting the current month clears the param rather than pinning it.
    expect(buildMonthFilterHref(base, 'month=2026-07', '2026-09', now)).toBe(base);
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
