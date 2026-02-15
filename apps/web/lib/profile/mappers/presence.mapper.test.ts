import { describe, expect, it } from 'vitest';
import type { ProfilePresenceRow } from '@iconicedu/shared-types';
import { mapProfilePresenceRowToVM } from '@iconicedu/web/lib/profile/mappers/presence.mapper';

describe('mapProfilePresenceRowToVM', () => {
  it('maps valid presence row fields', () => {
    const row = {
      id: 'presence-1',
      org_id: 'org-1',
      profile_id: 'profile-1',
      state_text: 'In a call',
      state_emoji: '📞',
      live_status: 'busy',
      display_status: 'busy',
      last_seen_at: '2026-02-15T00:00:00.000Z',
      presence_loaded: true,
    } as unknown as ProfilePresenceRow;

    const mapped = mapProfilePresenceRowToVM(row);
    expect(mapped?.liveStatus).toBe('busy');
    expect(mapped?.displayStatus).toBe('busy');
    expect(mapped?.state.text).toBe('In a call');
    expect(mapped?.state.emoji).toBe('📞');
  });

  it('falls back to offline for unknown live status', () => {
    const row = {
      id: 'presence-1',
      org_id: 'org-1',
      profile_id: 'profile-1',
      live_status: 'random_status',
      display_status: 'busy',
    } as unknown as ProfilePresenceRow;

    const mapped = mapProfilePresenceRowToVM(row);
    expect(mapped?.liveStatus).toBe('offline');
    expect(mapped?.displayStatus).toBe('busy');
  });

  it('returns null when row is deleted', () => {
    const row = {
      id: 'presence-1',
      org_id: 'org-1',
      profile_id: 'profile-1',
      live_status: 'away',
      deleted_at: '2026-02-15T00:00:00.000Z',
    } as unknown as ProfilePresenceRow;

    expect(mapProfilePresenceRowToVM(row)).toBeNull();
  });
});
