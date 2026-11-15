import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  guestJoinLiveSession,
  submitLiveSessionFeedback,
  reportLiveSessionQualityEvent,
  logLiveSessionAuditEvent,
} from './public-api';

describe('public live session API adapter', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  it('forwards authenticated identity and returns the server-issued display name', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          displayName: 'Verified Name',
          token: 'synthetic',
          sessionName: 'demo',
          expiresAt: null,
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    expect(
      await guestJoinLiveSession(
        'demo',
        { displayName: 'Client Name', passcode: 'demo' },
        'synthetic-auth',
      ),
    ).toMatchObject({ displayName: 'Verified Name' });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer synthetic-auth',
    );
  });
  it('returns actionable API errors and network failures for joining and feedback', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"message":"Incorrect passcode"}', { status: 403 }),
    );
    expect(
      await guestJoinLiveSession('demo', { displayName: 'Alex', passcode: 'wrong' }),
    ).toEqual({ status: 403, message: 'Incorrect passcode' });
    fetchMock.mockRejectedValue(new Error('Network offline'));
    expect(
      await submitLiveSessionFeedback('demo', { displayName: 'Alex', rating: 4 }),
    ).toEqual({ status: 0, message: 'Unable to reach the server' });
  });
  it('never throws when quality or audit reporting fails', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    await expect(
      reportLiveSessionQualityEvent('demo', {
        displayName: 'Alex',
        metric: 'network_quality',
        level: 'bad',
        occurredAt: '2026-01-01T00:00:00Z',
      }),
    ).resolves.toBeUndefined();
    fetchMock.mockRejectedValue(new Error('Offline'));
    await expect(
      logLiveSessionAuditEvent('demo', {
        action: 'recording_started',
        occurredAt: '2026-01-01T00:00:00Z',
      }),
    ).resolves.toBeUndefined();
  });
});
