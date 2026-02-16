import { describe, expect, it } from 'vitest';

import { shouldPublishPresence } from '@iconicedu/web/lib/presence/publish-policy';

describe('shouldPublishPresence', () => {
  it('publishes when forced', () => {
    expect(
      shouldPublishPresence({
        nextStatus: 'online',
        lastPublishedStatus: 'online',
        force: true,
        heartbeatMs: 60_000,
        lastOnlineHeartbeatAt: Date.now(),
      }),
    ).toBe(true);
  });

  it('publishes when status changes', () => {
    expect(
      shouldPublishPresence({
        nextStatus: 'away',
        lastPublishedStatus: 'online',
        heartbeatMs: 60_000,
        lastOnlineHeartbeatAt: Date.now(),
      }),
    ).toBe(true);
  });

  it('does not republish non-online statuses when unchanged', () => {
    expect(
      shouldPublishPresence({
        nextStatus: 'away',
        lastPublishedStatus: 'away',
        heartbeatMs: 60_000,
        lastOnlineHeartbeatAt: Date.now() - 120_000,
      }),
    ).toBe(false);
  });

  it('throttles unchanged online status until heartbeat window', () => {
    const now = Date.now();
    expect(
      shouldPublishPresence({
        nextStatus: 'online',
        lastPublishedStatus: 'online',
        now,
        heartbeatMs: 60_000,
        lastOnlineHeartbeatAt: now - 30_000,
      }),
    ).toBe(false);
    expect(
      shouldPublishPresence({
        nextStatus: 'online',
        lastPublishedStatus: 'online',
        now,
        heartbeatMs: 60_000,
        lastOnlineHeartbeatAt: now - 61_000,
      }),
    ).toBe(true);
  });
});
