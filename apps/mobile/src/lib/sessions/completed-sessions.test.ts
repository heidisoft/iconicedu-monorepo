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
  it('labels confirmed and auto-confirmed rows and keeps no confirm tile', () => {
    expect(fromProfileCompletion(completion({ rating: 5 }))).toMatchObject({
      title: 'Algebra',
      subtitle: 'Sam',
      statusLabel: 'Confirmed',
      awaitingConfirmation: false,
      rating: 5,
      completion: null,
    });
    expect(
      fromProfileCompletion(completion({ status: 'auto_confirmed' })).statusLabel,
    ).toBe('Auto-confirmed');
  });

  it('keeps the completion on pending rows so the confirm tile can render', () => {
    const pending = completion({ status: 'pending', sessionTitle: '  ' });
    const row = fromProfileCompletion(pending);
    expect(row.title).toBe('Session');
    expect(row.awaitingConfirmation).toBe(true);
    expect(row.completion).toBe(pending);
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

  it('puts only pending occurrences on the Awaiting tab and drops disputed ones', () => {
    const rows = adminRowsForTab(items, 'pending');
    expect(rows.map((row) => row.id)).toEqual(['c']);
    expect(rows[0].awaitingConfirmation).toBe(true);
  });
});
