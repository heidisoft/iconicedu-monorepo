import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import type {
  LiveSessionProviderAdapter,
  LiveSessionProviderCreateInput,
  LiveSessionJoinAccessInput,
  LiveSessionJoinAccessResult,
  NormalizedLiveSessionParticipantEvent,
} from '../types';

// Zoom Video SDK (not Meeting SDK) has no REST "create meeting" call — a session
// is created implicitly the moment the first signed JWT joins a given `tpc`
// (session name), so createSession only needs to derive stable identifiers and a
// shareable passcode. Auth: https://developers.zoom.us/docs/video-sdk/auth/
const PASSCODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PASSCODE_LENGTH = 10;
// Zoom requires exp to be between 1800s and 48h after iat; 2h gives headroom for
// a long class without minting a fresh token mid-session.
const JOIN_TOKEN_TTL_SECONDS = 2 * 60 * 60;

function getZoomVideoSdkConfig() {
  return {
    sdkKey: process.env.ZOOM_VIDEO_SDK_KEY ?? null,
    sdkSecret: process.env.ZOOM_VIDEO_SDK_SECRET ?? null,
    webhookSecretToken: process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? null,
  };
}

function buildZoomSessionName(input: LiveSessionProviderCreateInput) {
  const normalizedScope = input.scopeKey.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const scopeHash = crypto
    .createHash('sha1')
    .update(normalizedScope)
    .digest('hex')
    .slice(0, 10);
  return [
    'ls',
    input.orgId.replace(/-/g, '').slice(0, 8),
    input.channelId.replace(/-/g, '').slice(0, 8),
    scopeHash,
    input.sessionId.replace(/-/g, '').slice(0, 8),
  ].join('-');
}

// `session_key` is capped at 36 chars by Zoom; scopeKey can be arbitrarily long
// (e.g. "occurrence:2026-03-01T18:00:00.000Z"), so derive a short, stable key.
function buildZoomSessionKey(scopeKey: string) {
  return crypto.createHash('sha1').update(scopeKey).digest('hex').slice(0, 32);
}

function generateZoomPasscode(): string {
  const bytes = crypto.randomBytes(PASSCODE_LENGTH);
  let passcode = '';
  for (let i = 0; i < PASSCODE_LENGTH; i += 1) {
    passcode += PASSCODE_ALPHABET[bytes[i] % PASSCODE_ALPHABET.length];
  }
  return passcode;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Used by the public guest-join endpoint (apps/api) to gate token minting for
// visitors who aren't channel members — the passcode is the only access check
// for that path, so this must stay timing-safe.
export function verifyZoomPasscode(
  storedPasscode: string | null | undefined,
  candidate: string | null | undefined,
): boolean {
  if (!storedPasscode || !candidate) {
    return false;
  }
  return timingSafeStringEqual(storedPasscode, candidate);
}

function signZoomVideoSdkToken(input: {
  sessionName: string;
  sessionKey: string;
  userKey: string;
  isHost: boolean;
}): { token: string; expiresAt: string } {
  const config = getZoomVideoSdkConfig();
  if (!config.sdkKey || !config.sdkSecret) {
    throw new Error('Zoom Video SDK is not configured');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + JOIN_TOKEN_TTL_SECONDS;

  const token = jwt.sign(
    {
      app_key: config.sdkKey,
      tpc: input.sessionName,
      role_type: input.isHost ? 1 : 0,
      session_key: input.sessionKey,
      user_key: input.userKey,
      version: 1,
      iat: nowSeconds,
      exp: expSeconds,
    },
    config.sdkSecret,
    { algorithm: 'HS256' },
  );

  return { token, expiresAt: new Date(expSeconds * 1000).toISOString() };
}

function verifyZoomWebhookSignature(headers: Headers, body: string) {
  const { webhookSecretToken } = getZoomVideoSdkConfig();
  if (!webhookSecretToken) {
    return true;
  }

  const signature = headers.get('x-zm-signature');
  const timestamp = headers.get('x-zm-request-timestamp');
  if (!signature || !timestamp) {
    return false;
  }

  const expected =
    'v0=' +
    crypto
      .createHmac('sha256', webhookSecretToken)
      .update(`v0:${timestamp}:${body}`)
      .digest('hex');

  return timingSafeStringEqual(signature, expected);
}

// Zoom's one-time webhook CRC handshake: respond to `endpoint.url_validation`
// with the plainToken plus its HMAC, signed with the webhook Secret Token (not
// the SDK secret). This is a transport-level concern Zoom sends unsigned and
// outside the normal event stream, so it's answered via the adapter's
// `handleWebhookChallenge` before normalizeWebhook ever runs.
// https://developers.zoom.us/docs/api/webhooks/
function handleZoomUrlValidationChallenge(
  body: Record<string, unknown>,
): { plainToken: string; encryptedToken: string } | null {
  if (body.event !== 'endpoint.url_validation') {
    return null;
  }

  const plainToken =
    body.payload && typeof body.payload === 'object'
      ? (body.payload as Record<string, unknown>).plainToken
      : null;
  if (typeof plainToken !== 'string') {
    throw new Error('Zoom url_validation payload is missing plainToken');
  }

  const { webhookSecretToken } = getZoomVideoSdkConfig();
  if (!webhookSecretToken) {
    throw new Error('Zoom webhook secret token is not configured');
  }

  const encryptedToken = crypto
    .createHmac('sha256', webhookSecretToken)
    .update(plainToken)
    .digest('hex');

  return { plainToken, encryptedToken };
}

function normalizeZoomEvent(
  body: Record<string, unknown>,
): NormalizedLiveSessionParticipantEvent[] {
  const eventName = typeof body.event === 'string' ? body.event : null;
  const eventTimestampMs = typeof body.event_ts === 'number' ? body.event_ts : Date.now();
  const payload =
    body.payload && typeof body.payload === 'object'
      ? (body.payload as Record<string, unknown>)
      : {};
  const object =
    payload.object && typeof payload.object === 'object'
      ? (payload.object as Record<string, unknown>)
      : {};
  const providerSessionId =
    typeof object.session_name === 'string'
      ? object.session_name
      : typeof object.session_id === 'string'
        ? object.session_id
        : null;
  const user =
    object.user && typeof object.user === 'object'
      ? (object.user as Record<string, unknown>)
      : {};

  if (!eventName || !providerSessionId) {
    return [];
  }

  const base = {
    provider: 'zoom' as const,
    providerSessionId,
    providerEventId:
      typeof body.event_id === 'string'
        ? body.event_id
        : typeof object.id === 'string'
          ? object.id
          : null,
    providerParticipantId:
      typeof user.participant_uuid === 'string'
        ? user.participant_uuid
        : typeof user.id === 'string'
          ? user.id
          : null,
    // Guests mint their JWT with `user_key: guest:<uuid>` (see
    // LiveSessionsService.guestJoinLiveSession) so attendance can still tell a
    // guest event apart — but that string isn't a real profile id, and
    // channel_live_session_participant(_events).profile_id is a `uuid` column
    // referencing `profiles`, so passing it through would throw on insert
    // (invalid UUID syntax) or violate the FK. Null it out for guests; their
    // display name still comes through via participantDisplayName below.
    profileId:
      typeof user.user_key === 'string' && !user.user_key.startsWith('guest:')
        ? user.user_key
        : null,
    participantDisplayName: typeof user.name === 'string' ? user.name : null,
    participantEmail: typeof user.email === 'string' ? user.email : null,
    correlationKey: typeof object.session_id === 'string' ? object.session_id : null,
    occurredAt: new Date(eventTimestampMs).toISOString(),
    payload: object,
    raw: body,
  };

  switch (eventName) {
    case 'session.started':
      return [{ ...base, eventType: 'session_started' }];
    case 'session.ended':
      return [{ ...base, eventType: 'session_ended' }];
    case 'session.user_joined':
      return [{ ...base, eventType: 'participant_joined' }];
    case 'session.user_left':
      return [{ ...base, eventType: 'participant_left' }];
    default:
      return [];
  }
}

export const zoomVideoSdkLiveSessionProvider: LiveSessionProviderAdapter = {
  key: 'zoom',
  handleWebhookChallenge: handleZoomUrlValidationChallenge,
  async createSession(input: LiveSessionProviderCreateInput) {
    const sessionName = buildZoomSessionName(input);
    return {
      providerSessionId: sessionName,
      providerMetadata: {
        sessionName,
        sessionKey: buildZoomSessionKey(input.scopeKey),
        passcode: generateZoomPasscode(),
        mode: input.mode,
      },
    };
  },
  async getJoinAccess(
    input: LiveSessionJoinAccessInput,
  ): Promise<LiveSessionJoinAccessResult> {
    const sessionName =
      typeof input.providerMetadata?.sessionName === 'string'
        ? input.providerMetadata.sessionName
        : input.providerSessionId;
    const sessionKey =
      typeof input.providerMetadata?.sessionKey === 'string'
        ? input.providerMetadata.sessionKey
        : null;

    if (!sessionName || !sessionKey) {
      throw new Error('Live session is missing Zoom Video SDK session information');
    }

    const { token, expiresAt } = signZoomVideoSdkToken({
      sessionName,
      sessionKey,
      userKey: input.profileId,
      isHost: input.isHost ?? false,
    });

    return {
      token,
      expiresAt,
      metadata: {
        sessionName,
        sessionKey,
        displayName: input.displayName,
      },
    };
  },
  async normalizeWebhook(input) {
    if (!verifyZoomWebhookSignature(input.headers, input.body)) {
      throw new Error('Invalid Zoom webhook signature');
    }

    const parsed = JSON.parse(input.body) as Record<string, unknown>;
    return normalizeZoomEvent(parsed);
  },
};

export const __test__ = {
  buildZoomSessionName,
  buildZoomSessionKey,
  generateZoomPasscode,
};
