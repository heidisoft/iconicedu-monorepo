import { describe, expect, it } from 'vitest';

import { extractOnlineProfileIdsFromPresenceState } from '@iconicedu/web/lib/presence/realtime-presence';

describe('extractOnlineProfileIdsFromPresenceState', () => {
  it('extracts profile ids from metas', () => {
    const result = extractOnlineProfileIdsFromPresenceState({
      key1: { metas: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }] },
      key2: [{ profile_id: 'profile-3' }],
    });

    expect(Array.from(result).sort()).toEqual(['profile-1', 'profile-2', 'profile-3']);
  });

  it('falls back to presence key when profile_id is missing', () => {
    const result = extractOnlineProfileIdsFromPresenceState({
      'profile-1': { metas: [{}] },
    });

    expect(Array.from(result)).toEqual(['profile-1']);
  });
});
