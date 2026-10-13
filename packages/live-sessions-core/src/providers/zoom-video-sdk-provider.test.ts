import crypto from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';

import { __test__, zoomVideoSdkLiveSessionProvider } from './zoom-video-sdk-provider';

describe('zoom video sdk live session provider', () => {
  afterEach(() => {
    delete process.env.ZOOM_VIDEO_SDK_KEY;
    delete process.env.ZOOM_VIDEO_SDK_SECRET;
    delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  });

  it('builds a short provider-safe session name', () => {
    const sessionName = __test__.buildZoomSessionName({
      sessionId: '1b97c95c-79fb-48a4-9807-4141e9fa58d8',
      orgId: '8758c8e1-3925-411a-b6dd-342960728da4',
      channelId: '329426e1-983f-45bf-b391-f3faf369744e',
      scopeKey: 'occurrence:2026-03-01T18:00:00.000Z',
      mode: 'video',
    });

    expect(sessionName).toMatch(/^ls-[a-z0-9-]+$/);
    expect(sessionName.length).toBeLessThanOrEqual(200);
  });

  it("derives a session key within Zoom's 36 character limit", () => {
    const sessionKey = __test__.buildZoomSessionKey(
      'occurrence:2026-03-01T18:00:00.000Z-some-very-long-scope-identifier',
    );
    expect(sessionKey.length).toBeLessThanOrEqual(36);
  });

  it('generates an alphanumeric passcode on session creation', async () => {
    const result = await zoomVideoSdkLiveSessionProvider.createSession({
      sessionId: 'session-1',
      orgId: 'org-1',
      channelId: 'channel-1',
      scopeKey: 'occurrence:2026-03-01T18:00:00.000Z',
      mode: 'video',
    });

    expect(result.providerMetadata?.passcode).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(result.providerMetadata?.sessionName).toBe(result.providerSessionId);
  });

  it('signs a join token with the expected Video SDK claims', async () => {
    process.env.ZOOM_VIDEO_SDK_KEY = 'test-sdk-key';
    process.env.ZOOM_VIDEO_SDK_SECRET = 'test-sdk-secret';

    const result = await zoomVideoSdkLiveSessionProvider.getJoinAccess({
      sessionId: 'session-1',
      providerSessionId: 'ls-session',
      providerMetadata: { sessionName: 'ls-session', sessionKey: 'scope-key' },
      profileId: 'profile-1',
      displayName: 'Test User',
      isHost: true,
    });

    expect(result.token).toBeTruthy();
    const decoded = jwt.verify(result.token as string, 'test-sdk-secret') as Record<
      string,
      unknown
    >;
    expect(decoded.app_key).toBe('test-sdk-key');
    expect(decoded.tpc).toBe('ls-session');
    expect(decoded.role_type).toBe(1);
    expect(decoded.session_key).toBe('scope-key');
    expect(decoded.user_key).toBe('profile-1');
    expect(decoded.version).toBe(1);
  });

  it('defaults to participant role when isHost is not set', async () => {
    process.env.ZOOM_VIDEO_SDK_KEY = 'test-sdk-key';
    process.env.ZOOM_VIDEO_SDK_SECRET = 'test-sdk-secret';

    const result = await zoomVideoSdkLiveSessionProvider.getJoinAccess({
      sessionId: 'session-1',
      providerSessionId: 'ls-session',
      providerMetadata: { sessionName: 'ls-session', sessionKey: 'scope-key' },
      profileId: 'profile-1',
      displayName: 'Test User',
    });

    const decoded = jwt.verify(result.token as string, 'test-sdk-secret') as Record<
      string,
      unknown
    >;
    expect(decoded.role_type).toBe(0);
  });

  it('normalizes participant identity metadata from Zoom webhook payloads', async () => {
    const events = await zoomVideoSdkLiveSessionProvider.normalizeWebhook({
      headers: new Headers(),
      body: JSON.stringify({
        event: 'session.user_joined',
        event_ts: Date.parse('2026-03-02T10:00:00.000Z'),
        payload: {
          account_id: 'account-1',
          object: {
            id: 'object-1',
            session_id: 'session-correlation-1',
            session_name: 'ls-session',
            session_key: 'scope-key',
            user: {
              id: 'provider-participant-1',
              participant_uuid: 'provider-participant-1',
              user_key: 'profile-1',
              name: 'Taylor Reed',
              email: 'iconicedudev+taylor@gmail.com',
            },
          },
        },
      }),
    });

    expect(events).toEqual([
      expect.objectContaining({
        provider: 'zoom',
        providerSessionId: 'ls-session',
        providerParticipantId: 'provider-participant-1',
        profileId: 'profile-1',
        participantDisplayName: 'Taylor Reed',
        participantEmail: 'iconicedudev+taylor@gmail.com',
        correlationKey: 'session-correlation-1',
        eventType: 'participant_joined',
      }),
    ]);
  });

  it('nulls out profileId for guest participants instead of passing a non-UUID string through', async () => {
    // channel_live_session_participant(_events).profile_id is a `uuid` column —
    // a raw `guest:<uuid>` user_key would throw "invalid input syntax for
    // type uuid" on insert if this ever regressed.
    const events = await zoomVideoSdkLiveSessionProvider.normalizeWebhook({
      headers: new Headers(),
      body: JSON.stringify({
        event: 'session.user_joined',
        event_ts: Date.parse('2026-03-02T10:00:00.000Z'),
        payload: {
          object: {
            session_id: 'session-correlation-1',
            session_name: 'ls-session',
            user: {
              id: 'provider-participant-2',
              user_key: 'guest:3f9a1c2e-79fb-48a4-9807-4141e9fa58d8',
              name: 'Jordan Lee',
            },
          },
        },
      }),
    });

    expect(events).toEqual([
      expect.objectContaining({
        profileId: null,
        participantDisplayName: 'Jordan Lee',
        eventType: 'participant_joined',
      }),
    ]);
  });

  it('rejects webhook payloads with an invalid signature', async () => {
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'webhook-secret';

    await expect(
      zoomVideoSdkLiveSessionProvider.normalizeWebhook({
        headers: new Headers({
          'x-zm-signature': 'v0=invalid',
          'x-zm-request-timestamp': '1700000000',
        }),
        body: JSON.stringify({ event: 'session.started' }),
      }),
    ).rejects.toThrow('Invalid Zoom webhook signature');
  });

  it('accepts webhook payloads with a valid signature', async () => {
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'webhook-secret';
    const timestamp = '1700000000';
    const body = JSON.stringify({
      event: 'session.ended',
      event_ts: Date.parse('2026-03-02T10:05:00.000Z'),
      payload: {
        object: { session_name: 'ls-session', session_id: 'session-correlation-1' },
      },
    });
    const signature =
      'v0=' +
      crypto
        .createHmac('sha256', 'webhook-secret')
        .update(`v0:${timestamp}:${body}`)
        .digest('hex');

    const events = await zoomVideoSdkLiveSessionProvider.normalizeWebhook({
      headers: new Headers({
        'x-zm-signature': signature,
        'x-zm-request-timestamp': timestamp,
      }),
      body,
    });

    expect(events).toEqual([
      expect.objectContaining({
        eventType: 'session_ended',
        providerSessionId: 'ls-session',
      }),
    ]);
  });

  it('answers the endpoint.url_validation CRC challenge', () => {
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'webhook-secret';

    const response = zoomVideoSdkLiveSessionProvider.handleWebhookChallenge?.({
      event: 'endpoint.url_validation',
      payload: { plainToken: 'abc123' },
    });

    expect(response?.plainToken).toBe('abc123');
    expect(response?.encryptedToken).toBe(
      crypto.createHmac('sha256', 'webhook-secret').update('abc123').digest('hex'),
    );
  });

  it('returns null for non-validation webhook payloads', () => {
    expect(
      zoomVideoSdkLiveSessionProvider.handleWebhookChallenge?.({
        event: 'session.started',
      }),
    ).toBeNull();
  });
});
