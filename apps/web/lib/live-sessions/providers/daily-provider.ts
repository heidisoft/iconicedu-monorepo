import crypto from 'node:crypto';

import type {
  LiveSessionProviderAdapter,
  LiveSessionProviderCreateInput,
  LiveSessionProviderCreateResult,
  LiveSessionJoinAccessInput,
  LiveSessionJoinAccessResult,
  NormalizedLiveSessionParticipantEvent,
} from '@iconicedu/web/lib/live-sessions/types';

const DEFAULT_DAILY_REST_BASE_URL = 'https://api.daily.co/v1';

type DailyRoomResponse = {
  id?: string;
  name?: string;
  url?: string;
  api_created?: boolean;
};

type DailyMeetingTokenResponse = {
  token?: string;
};

function getDailyConfig() {
  return {
    apiKey: process.env.DAILY_API_KEY ?? null,
    restBaseUrl: process.env.DAILY_REST_BASE_URL ?? DEFAULT_DAILY_REST_BASE_URL,
    webhookSecret: process.env.DAILY_WEBHOOK_SECRET ?? null,
  };
}

function buildDailyRoomName(input: LiveSessionProviderCreateInput) {
  const normalizedScope = input.scopeKey.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const scopeHash = crypto.createHash('sha1').update(normalizedScope).digest('hex').slice(0, 10);
  return [
    'ls',
    input.orgId.replace(/-/g, '').slice(0, 8),
    input.channelId.replace(/-/g, '').slice(0, 8),
    scopeHash,
    input.sessionId.replace(/-/g, '').slice(0, 8),
  ].join('-');
}

async function createDailyRoom(input: LiveSessionProviderCreateInput): Promise<DailyRoomResponse> {
  const config = getDailyConfig();
  if (!config.apiKey) {
    throw new Error('Daily is not configured');
  }

  const roomName = buildDailyRoomName(input);
  const response = await fetch(`${config.restBaseUrl}/rooms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        enable_prejoin_ui: true,
        start_video_off: input.mode === 'audio',
        start_audio_off: false,
        enable_screenshare: input.mode === 'video',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Daily room creation failed: ${response.status}${errorText ? ` ${errorText}` : ''}`,
    );
  }

  return (await response.json()) as DailyRoomResponse;
}

async function createDailyMeetingToken(input: {
  roomName: string;
  profileId: string;
  displayName: string;
}): Promise<DailyMeetingTokenResponse> {
  const config = getDailyConfig();
  if (!config.apiKey) {
    throw new Error('Daily is not configured');
  }

  const response = await fetch(`${config.restBaseUrl}/meeting-tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        room_name: input.roomName,
        user_id: input.profileId,
        user_name: input.displayName,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Daily meeting token creation failed: ${response.status}${errorText ? ` ${errorText}` : ''}`,
    );
  }

  return (await response.json()) as DailyMeetingTokenResponse;
}

function verifyDailyWebhookSignature(headers: Headers, body: string) {
  const { webhookSecret } = getDailyConfig();
  if (!webhookSecret) {
    return true;
  }

  const signature = headers.get('daily-signature');
  if (!signature) {
    return false;
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  return signature.includes(expected);
}

function normalizeDailyEvent(body: Record<string, unknown>): NormalizedLiveSessionParticipantEvent[] {
  const eventName =
    typeof body.event === 'string'
      ? body.event
      : typeof body.name === 'string'
        ? body.name
        : null;
  const payload =
    body.payload && typeof body.payload === 'object'
      ? (body.payload as Record<string, unknown>)
      : body;
  const room =
    payload.room && typeof payload.room === 'object'
      ? (payload.room as Record<string, unknown>)
      : {};
  const participant =
    payload.participant && typeof payload.participant === 'object'
      ? (payload.participant as Record<string, unknown>)
      : {};
  const providerSessionId =
    typeof room.name === 'string'
      ? room.name
      : typeof payload.room_name === 'string'
        ? payload.room_name
        : null;

  if (!eventName || !providerSessionId) {
    return [];
  }

  const base = {
    provider: 'daily' as const,
    providerSessionId,
    providerEventId:
      typeof body.id === 'string'
        ? body.id
        : typeof payload.id === 'string'
          ? payload.id
          : null,
    providerParticipantId:
      typeof participant.id === 'string' ? participant.id : null,
    profileId:
      typeof participant.user_id === 'string' ? participant.user_id : null,
    occurredAt:
      typeof payload.ts === 'number'
        ? new Date(payload.ts).toISOString()
        : typeof body.timestamp === 'number'
          ? new Date(body.timestamp).toISOString()
          : new Date().toISOString(),
    payload,
  };

  switch (eventName) {
    case 'meeting.started':
      return [{ ...base, eventType: 'session_started' }];
    case 'meeting.ended':
      return [{ ...base, eventType: 'session_ended' }];
    case 'participant.joined':
      return [{ ...base, eventType: 'participant_joined' }];
    case 'participant.left':
      return [{ ...base, eventType: 'participant_left' }];
    default:
      return [];
  }
}

export const dailyLiveSessionProvider: LiveSessionProviderAdapter = {
  key: 'daily',
  async createSession(input: LiveSessionProviderCreateInput): Promise<LiveSessionProviderCreateResult> {
    const room = await createDailyRoom(input);
    const providerSessionId = room.name ?? room.id;
    if (!providerSessionId) {
      throw new Error('Daily room response is missing an id');
    }

    return {
      providerSessionId,
      providerMetadata: {
        roomId: room.id ?? null,
        roomName: room.name ?? null,
        roomUrl: room.url ?? null,
      },
    };
  },
  async getJoinAccess(input: LiveSessionJoinAccessInput): Promise<LiveSessionJoinAccessResult> {
    const roomName =
      typeof input.providerMetadata?.roomName === 'string'
        ? input.providerMetadata.roomName
        : input.providerSessionId;
    const roomUrl =
      typeof input.providerMetadata?.roomUrl === 'string'
        ? input.providerMetadata.roomUrl
        : null;

    if (!roomName || !roomUrl) {
      throw new Error('Live session is missing Daily room information');
    }

    const tokenResponse = await createDailyMeetingToken({
      roomName,
      profileId: input.profileId,
      displayName: input.displayName,
    });

    if (!tokenResponse.token) {
      throw new Error('Daily meeting token is missing');
    }

    return {
      joinUrl: `${roomUrl}?t=${encodeURIComponent(tokenResponse.token)}`,
      token: tokenResponse.token,
      metadata: {
        roomName,
        roomUrl,
      },
    };
  },
  async normalizeWebhook(input) {
    if (!verifyDailyWebhookSignature(input.headers, input.body)) {
      throw new Error('Invalid Daily webhook signature');
    }

    const parsed = JSON.parse(input.body) as Record<string, unknown>;
    return normalizeDailyEvent(parsed);
  },
};

export const __test__ = {
  buildDailyRoomName,
};
