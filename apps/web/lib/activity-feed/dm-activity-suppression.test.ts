import { describe, expect, it } from 'vitest';

import { filterDmRecipientsByLastReadRecency } from '@iconicedu/web/lib/activity-feed/dm-activity-suppression';

describe('filterDmRecipientsByLastReadRecency', () => {
  it('suppresses recipients with recent read-state activity', () => {
    const result = filterDmRecipientsByLastReadRecency({
      candidateProfileIds: ['p-1', 'p-2'],
      profileLastReadAtById: new Map([
        ['p-1', '2026-03-09T10:00:30.000Z'],
        ['p-2', null],
      ]),
      now: '2026-03-09T10:02:00.000Z',
    });

    expect(result.suppressedProfileIds).toEqual(['p-1']);
    expect(result.emittedProfileIds).toEqual(['p-2']);
  });

  it('does not suppress recipients with stale read-state activity', () => {
    const result = filterDmRecipientsByLastReadRecency({
      candidateProfileIds: ['p-1'],
      profileLastReadAtById: new Map([['p-1', '2026-03-09T09:59:59.000Z']]),
      now: '2026-03-09T10:02:00.000Z',
    });

    expect(result.suppressedProfileIds).toEqual([]);
    expect(result.emittedProfileIds).toEqual(['p-1']);
  });

  it('does not suppress recipients with missing read-state values', () => {
    const result = filterDmRecipientsByLastReadRecency({
      candidateProfileIds: ['p-1', 'p-2'],
      profileLastReadAtById: new Map([['p-1', undefined]]),
      now: '2026-03-09T10:02:00.000Z',
    });

    expect(result.suppressedProfileIds).toEqual([]);
    expect(result.emittedProfileIds).toEqual(['p-1', 'p-2']);
  });
});
