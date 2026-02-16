import { describe, expect, it } from 'vitest';

import {
  deriveConnectionStatusFromActivity,
  deriveDisplayStatusFromPresenceRow,
  mapConnectionStatusToDisplayStatus,
  mapConnectionStatusToLiveStatus,
  PRESENCE_AWAY_AFTER_MS,
  PRESENCE_OFFLINE_AFTER_MS,
} from '@iconicedu/web/lib/presence/status';

describe('presence status helpers', () => {
  it('maps connection status to live/display status', () => {
    expect(mapConnectionStatusToLiveStatus('online')).toBe('online');
    expect(mapConnectionStatusToLiveStatus('away')).toBe('away');
    expect(mapConnectionStatusToLiveStatus('offline')).toBe('offline');
    expect(mapConnectionStatusToDisplayStatus('online')).toBe('online');
    expect(mapConnectionStatusToDisplayStatus('away')).toBe('away');
    expect(mapConnectionStatusToDisplayStatus('offline')).toBe('offline');
  });

  it('derives connection status from activity and window state', () => {
    const now = Date.now();
    expect(
      deriveConnectionStatusFromActivity({
        now,
        lastActivityAt: now - 15_000,
        hasActiveWindow: true,
      }),
    ).toBe('online');
    expect(
      deriveConnectionStatusFromActivity({
        now,
        lastActivityAt: now - PRESENCE_AWAY_AFTER_MS - 1,
        hasActiveWindow: true,
      }),
    ).toBe('away');
    expect(
      deriveConnectionStatusFromActivity({
        now,
        lastActivityAt: now - 10_000,
        hasActiveWindow: false,
      }),
    ).toBe('away');
  });

  it('derives display status with staleness fallback', () => {
    const now = Date.now();
    expect(
      deriveDisplayStatusFromPresenceRow({
        now,
        reportedStatus: 'online',
        lastSeenAt: new Date(now - 5_000).toISOString(),
      }),
    ).toBe('online');
    expect(
      deriveDisplayStatusFromPresenceRow({
        now,
        reportedStatus: 'online',
        lastSeenAt: new Date(now - PRESENCE_AWAY_AFTER_MS - 1).toISOString(),
      }),
    ).toBe('away');
    expect(
      deriveDisplayStatusFromPresenceRow({
        now,
        reportedStatus: 'busy',
        lastSeenAt: new Date(now - 5_000).toISOString(),
      }),
    ).toBe('busy');
    expect(
      deriveDisplayStatusFromPresenceRow({
        now,
        reportedStatus: 'away',
        lastSeenAt: new Date(now - PRESENCE_OFFLINE_AFTER_MS - 1).toISOString(),
      }),
    ).toBe('offline');
  });
});
