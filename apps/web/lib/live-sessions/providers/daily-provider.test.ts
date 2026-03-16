import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __test__,
  dailyLiveSessionProvider,
} from '@iconicedu/web/lib/live-sessions/providers/daily-provider';

describe('daily live session provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DAILY_API_KEY;
  });

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

  it('returns sdk join access separately from the external tokenized url', async () => {
    process.env.DAILY_API_KEY = 'test-key';

    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'meeting-token' }),
    } as Response);

    const result = await dailyLiveSessionProvider.getJoinAccess({
      sessionId: 'session-1',
      providerSessionId: 'room-name',
      providerMetadata: {
        roomName: 'room-name',
        roomUrl: 'https://example.daily.co/room-name',
        mode: 'video',
      },
      profileId: 'profile-1',
      displayName: 'Test User',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.joinUrl).toBe('https://example.daily.co/room-name');
    expect(result.token).toBe('meeting-token');
    expect(result.metadata?.externalJoinUrl).toBe(
      'https://example.daily.co/room-name?t=meeting-token',
    );
  });

  it('normalizes participant identity metadata from Daily webhook payloads', async () => {
    const events = await dailyLiveSessionProvider.normalizeWebhook({
      headers: new Headers(),
      body: JSON.stringify({
        event: 'participant.joined',
        id: 'evt-1',
        payload: {
          ts: Date.parse('2026-03-02T10:00:00.000Z'),
          room: { name: 'room-name' },
          participant: {
            id: 'provider-participant-1',
            user_id: 'profile-1',
            user_name: 'Taylor Reed',
            user_email: 'taylor@example.com',
            session_id: 'session-correlation-1',
          },
        },
      }),
    });

    expect(events).toEqual([
      expect.objectContaining({
        provider: 'daily',
        providerSessionId: 'room-name',
        providerParticipantId: 'provider-participant-1',
        profileId: 'profile-1',
        participantDisplayName: 'Taylor Reed',
        participantEmail: 'taylor@example.com',
        correlationKey: 'session-correlation-1',
      }),
    ]);
  });
});
