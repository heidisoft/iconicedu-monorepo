import { describe, expect, it } from 'vitest';

import type { LiveSessionAttendanceListItemVM } from '@iconicedu/shared-types';
import {
  buildMonthlyAttendanceTrend,
  buildPersonBreakdown,
  filterAttendanceRows,
  summarizeAttendance,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-analytics';

const teacher = {
  ids: { id: 'teacher-1', orgId: 'org-1', accountId: 'account-1' },
  kind: 'educator' as const,
  profile: {
    displayName: 'Taylor Reed',
    avatar: { source: 'generated' as const, seed: null, url: null },
  },
};

const parent = {
  ids: { id: 'parent-1', orgId: 'org-1', accountId: 'account-2' },
  kind: 'guardian' as const,
  profile: {
    displayName: 'Morgan Lee',
    avatar: { source: 'generated' as const, seed: null, url: null },
  },
};

function row(overrides: Partial<LiveSessionAttendanceListItemVM> = {}) {
  return {
    ids: { id: 'session-1', orgId: 'org-1', channelId: 'channel-1' },
    provider: 'daily',
    status: 'ended',
    scope: 'scheduled',
    channelTopic: 'Algebra',
    channelPurpose: 'learning-space',
    learningSpaceTitle: 'Algebra tutoring',
    startedAt: '2026-03-10T14:00:00.000Z',
    endedAt: '2026-03-10T15:00:00.000Z',
    joinPath: '/join',
    startedBy: teacher,
    participants: [parent],
    metrics: {
      participantCount: 4,
      expectedParticipantCount: 4,
      attendeeCount: 3,
      fullAttendanceCount: 2,
      partialAttendanceCount: 1,
      noShowCount: 1,
    },
    ...overrides,
  } as LiveSessionAttendanceListItemVM;
}

describe('session attendance analytics', () => {
  it('summarizes completed sessions and ignores non-ended rows', () => {
    const summary = summarizeAttendance([
      row(),
      row({
        ids: { id: 'session-2', orgId: 'org-1', channelId: 'channel-1' },
        status: 'live',
      }),
    ]);

    expect(summary).toEqual({
      completedSessions: 1,
      attendanceRate: 0.75,
      fullAttendanceRate: 0.5,
      noShows: 1,
    });
  });

  it('filters by month, teacher, parent, status, scope, and search', () => {
    const rows = [
      row(),
      row({
        ids: { id: 'session-2', orgId: 'org-1', channelId: 'channel-2' },
        startedAt: '2026-02-10T14:00:00.000Z',
        channelTopic: 'Reading',
      }),
    ];
    const result = filterAttendanceRows(rows, {
      search: 'morgan',
      month: '2026-03',
      teacherId: 'teacher-1',
      parentId: 'parent-1',
      status: 'ended',
      scope: 'scheduled',
    });

    expect(result.map((item) => item.ids.id)).toEqual(['session-1']);
  });

  it('builds chronological monthly and people breakdowns', () => {
    const rows = [
      row(),
      row({
        ids: { id: 'session-2', orgId: 'org-1', channelId: 'channel-2' },
        startedAt: '2026-02-10T14:00:00.000Z',
      }),
    ];

    expect(buildMonthlyAttendanceTrend(rows).map((point) => point.key)).toEqual([
      '2026-02',
      '2026-03',
    ]);
    expect(buildPersonBreakdown(rows, 'teacher')[0]).toMatchObject({
      name: 'Taylor Reed',
      sessions: 2,
    });
    expect(buildPersonBreakdown(rows, 'parent')[0]).toMatchObject({
      name: 'Morgan Lee',
      sessions: 2,
    });
  });
});
