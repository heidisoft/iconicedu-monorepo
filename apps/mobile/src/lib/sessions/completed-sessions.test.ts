import type {
  AdminSessionCompletionVM,
  SessionCompletionVM,
} from '@iconicedu/shared-types';
import { adminRowsForTab, fromProfileCompletion, monthRange } from './completed-sessions';

function completion(overrides: Partial<SessionCompletionVM> = {}): SessionCompletionVM {
  return {
    id: 'completion-1',
    orgId: 'org-1',
    scheduleId: 'schedule-1',
    occurrenceKey: '2026-11-03T15:00:00.000Z',
    profileId: 'profile-1',
    role: 'student' as SessionCompletionVM['role'],
    status: 'confirmed',
    rescheduleRequested: false,
    sessionTitle: 'Algebra',
    studentName: 'Sam',
    sessionEndAt: '2026-11-03T16:00:00.000Z',
    expiresAt: '2026-11-06T16:00:00.000Z',
    ...overrides,
  };
}

function adminItem(
  id: string,
  completionMethod: AdminSessionCompletionVM['completionMethod'],
  sessionEndAt: string,
): AdminSessionCompletionVM {
  return {
    id,
    orgId: 'org-1',
    scheduleId: 'schedule-1',
    occurrenceKey: sessionEndAt,
    sessionEndAt,
    sessionTitle: null,
    learningSpaceTitle: 'Geometry',
    studentNames: ['Ava', 'Ben'],
    completedAt: sessionEndAt,
    completionMethod,
    confirmedBy: [],
    guardians: [],
    averageRating: 4.5,
    reports: [],
  };
}

describe('monthRange', () => {
  const now = new Date(2026, 10, 27, 12, 0, 0); // 27 Nov 2026, local time

  it('spans the current local month for offset 0', () => {
    const range = monthRange(0, now);
    expect(range.monthKey).toBe('2026-11');
    expect(range.start).toBe(new Date(2026, 10, 1).toISOString());
    expect(range.end).toBe(new Date(2026, 11, 1).toISOString());
  });

  it('crosses year boundaries for negative offsets', () => {
    const range = monthRange(-11, now);
    expect(range.monthKey).toBe('2025-12');
    expect(range.end).toBe(new Date(2026, 0, 1).toISOString());
  });
});

describe('fromProfileCompletion', () => {
  it('labels a self-confirmed row and only lets it be rated when unrated', () => {
    expect(
      fromProfileCompletion(completion({ rating: 5, confirmedBy: 'self' })),
    ).toMatchObject({
      title: 'Algebra',
      subtitle: 'Sam',
      statusLabel: 'Confirmed',
      awaitingConfirmation: false,
      rating: 5,
      confirmedBy: 'self',
      reportable: false,
      ratable: false,
    });
    expect(fromProfileCompletion(completion({ confirmedBy: 'self' })).ratable).toBe(true);
  });

  it('lets staff-marked and auto-confirmed rows be reported until they are', () => {
    const staff = fromProfileCompletion(completion({ confirmedBy: 'staff' }));
    expect(staff).toMatchObject({
      statusLabel: 'Marked by staff',
      reportable: true,
      ratable: true,
      reportCount: 0,
    });

    const auto = fromProfileCompletion(
      completion({ status: 'auto_confirmed', confirmedBy: 'system' }),
    );
    expect(auto).toMatchObject({ statusLabel: 'Auto-confirmed', reportable: true });

    const reported = fromProfileCompletion(
      completion({
        confirmedBy: 'staff',
        report: {
          category: 'did_not_happen',
          reason: null,
          reportedAt: '2026-11-04T10:00:00.000Z',
        },
      }),
    );
    expect(reported).toMatchObject({ reportable: false, reportCount: 1 });
  });

  it('falls back to the status when an older API omits confirmedBy', () => {
    expect(fromProfileCompletion(completion({ status: 'auto_confirmed' }))).toMatchObject(
      {
        confirmedBy: 'system',
        statusLabel: 'Auto-confirmed',
      },
    );
    expect(fromProfileCompletion(completion()).confirmedBy).toBe('self');
  });

  it('keeps the completion on pending rows so the confirm tile can render', () => {
    const pending = completion({ status: 'pending', sessionTitle: '  ' });
    const row = fromProfileCompletion(pending);
    expect(row.title).toBe('Session');
    expect(row.awaitingConfirmation).toBe(true);
    expect(row.completion).toBe(pending);
    expect(row).toMatchObject({ confirmedBy: null, reportable: false, ratable: false });
  });
});

describe('adminRowsForTab', () => {
  const items = [
    adminItem('a', 'confirmed', '2026-11-01T10:00:00.000Z'),
    adminItem('b', 'mixed', '2026-11-05T10:00:00.000Z'),
    adminItem('c', 'pending', '2026-11-04T10:00:00.000Z'),
    adminItem('d', 'disputed', '2026-11-03T10:00:00.000Z'),
    adminItem('e', 'auto_confirmed', '2026-11-02T10:00:00.000Z'),
  ];

  it('puts confirmed, auto-confirmed and mixed occurrences on the Completed tab, newest first', () => {
    const rows = adminRowsForTab(items, 'completed');
    expect(rows.map((row) => row.id)).toEqual(['b', 'e', 'a']);
    expect(rows[0]).toMatchObject({
      title: 'Geometry',
      subtitle: 'Ava, Ben',
      statusLabel: 'Confirmed',
      rating: 4.5,
      completion: null,
    });
    expect(rows[1].statusLabel).toBe('Auto-confirmed');
  });

  it('counts reports on admin rows but never offers rating or reporting', () => {
    const reported = adminItem('r', 'confirmed', '2026-11-06T10:00:00.000Z');
    reported.reports = [
      {
        profileId: 'p1',
        displayName: 'Ava',
        role: 'child' as AdminSessionCompletionVM['confirmedBy'][number]['role'],
        category: 'did_not_happen',
        reason: null,
        reportedAt: '2026-11-07T10:00:00.000Z',
      },
    ];
    expect(adminRowsForTab([reported], 'completed')[0]).toMatchObject({
      reportCount: 1,
      reportable: false,
      ratable: false,
    });
  });

  it('puts only pending occurrences on the Awaiting tab and drops disputed ones', () => {
    const rows = adminRowsForTab(items, 'pending');
    expect(rows.map((row) => row.id)).toEqual(['c']);
    expect(rows[0].awaitingConfirmation).toBe(true);
  });
});
