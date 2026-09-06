import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { summarizeSessionCompletions } from './use-completed-sessions';

function completion(
  id: string,
  status: SessionCompletionVM['status'],
): SessionCompletionVM {
  return {
    id,
    orgId: 'org-1',
    scheduleId: 'schedule-1',
    occurrenceKey: '2026-09-04T15:00:00.000Z',
    profileId: 'profile-1',
    role: 'child',
    status,
    disputeCategory: null,
    disputeReason: null,
    rescheduleRequested: false,
    rating: null,
    ratingComment: null,
    channelId: null,
    learningSpaceId: null,
    sessionTitle: 'Algebra',
    sessionEndAt: '2026-09-04T16:00:00.000Z',
    notifiedAt: null,
    confirmedAt: null,
    disputedAt: null,
    ratedAt: null,
    resolvedAt: null,
    expiresAt: '2026-09-07T16:00:00.000Z',
  };
}

describe('summarizeSessionCompletions', () => {
  it('separates completed sessions from pending review', () => {
    expect(
      summarizeSessionCompletions([
        completion('pending', 'pending'),
        completion('confirmed', 'confirmed'),
        completion('auto-confirmed', 'auto_confirmed'),
        completion('disputed', 'disputed'),
      ]),
    ).toEqual({ completed: 2, pending: 1 });
  });
});
