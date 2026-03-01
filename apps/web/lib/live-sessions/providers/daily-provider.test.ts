import { describe, expect, it } from 'vitest';

import { __test__ } from '@iconicedu/web/lib/live-sessions/providers/daily-provider';

describe('daily live session provider', () => {
  it('builds a short provider-safe room name', () => {
    const roomName = __test__.buildDailyRoomName({
      sessionId: '1b97c95c-79fb-48a4-9807-4141e9fa58d8',
      orgId: '8758c8e1-3925-411a-b6dd-342960728da4',
      channelId: '329426e1-983f-45bf-b391-f3faf369744e',
      scopeKey: 'occurrence:2026-03-01T18:00:00.000Z',
      mode: 'video',
    });

    expect(roomName).toMatch(/^ls-[a-z0-9-]+$/);
    expect(roomName.length).toBeLessThanOrEqual(63);
  });
});
