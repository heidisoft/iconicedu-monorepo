import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  pollExpoPushReceipts,
  sendPushNotification,
} from '@iconicedu/web/lib/notifications/providers/push-provider';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockIsNull = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockIn = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'push_tokens') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return {};
    }),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_PAYLOAD = {
  orgId: 'org-1',
  recipientProfileId: 'profile-1',
  prefKey: 'message.posted',
  title: 'New message',
  summary: 'Hello!',
  activityFeedItemId: null,
  threadId: null,
};

function setupSelectChain(result: { data: unknown[] | null; error: unknown }) {
  mockIsNull.mockResolvedValue(result);
  mockEq.mockReturnValue({ is: mockIsNull });
  mockSelect.mockReturnValue({ eq: mockEq });
}

function setupUpdateChain(result: { error: unknown } = { error: null }) {
  mockIn.mockResolvedValue(result);
  mockUpdate.mockReturnValue({ in: mockIn });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('sendPushNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    setupUpdateChain();
  });

  it('returns early when no active tokens exist', async () => {
    setupSelectChain({ data: [], error: null });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await sendPushNotification(BASE_PAYLOAD);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws when the database query fails', async () => {
    setupSelectChain({ data: null, error: { message: 'DB error' } });

    await expect(sendPushNotification(BASE_PAYLOAD)).rejects.toThrow('DB error');
  });

  it('sends one message per active token to the Expo Push API', async () => {
    setupSelectChain({
      data: [
        { id: 'tok-1', token: 'ExponentPushToken[aaa]' },
        { id: 'tok-2', token: 'ExponentPushToken[bbb]' },
      ],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }, { status: 'ok' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification(BASE_PAYLOAD);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    const body = JSON.parse(init.body as string) as unknown[];
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      to: 'ExponentPushToken[aaa]',
      title: 'New message',
      body: 'Hello!',
      channelId: 'default',
    });
  });

  it('adds the Expo authorization header when EXPO_ACCESS_TOKEN is configured', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });
    vi.stubEnv('EXPO_ACCESS_TOKEN', 'expo-token-123');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification(BASE_PAYLOAD);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer expo-token-123',
    );
  });

  it('includes channelId in push data when metadata has a channel id', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification({
      ...BASE_PAYLOAD,
      scopeKind: 'learning_space',
      scopeId: 'space-1',
      metadata: {
        rawEventPayload: {
          channelId: 'channel-42',
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Array<{
      data?: { channelId?: string };
    }>;
    expect(body[0]?.data?.channelId).toBe('channel-42');
  });

  it('includes activityFeedItemId in push data when provided', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification({
      ...BASE_PAYLOAD,
      activityFeedItemId: 'feed-1',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Array<{
      data?: { activityFeedItemId?: string | null };
    }>;

    expect(body[0]?.data?.activityFeedItemId).toBe('feed-1');
  });

  it('includes threadId in push data when provided in metadata', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification({
      ...BASE_PAYLOAD,
      metadata: {
        threadId: 'thread-1',
        rawEventPayload: {
          channelId: 'channel-42',
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Array<{
      data?: { threadId?: string | null };
    }>;

    expect(body[0]?.data?.threadId).toBe('thread-1');
  });

  it('includes senderName in push data for dm.posted when metadata provides senderName', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification({
      ...BASE_PAYLOAD,
      prefKey: 'dm.posted',
      metadata: {
        rawEventPayload: {
          channelId: 'channel-42',
          senderName: 'Alice',
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Array<{
      data?: { senderName?: string };
    }>;

    expect(body[0]?.data?.senderName).toBe('Alice');
  });

  it('does not include senderName in push data for dm.posted when metadata lacks senderName', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification({
      ...BASE_PAYLOAD,
      prefKey: 'dm.posted',
      metadata: {
        rawEventPayload: {
          channelId: 'channel-42',
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Array<{
      data?: { senderName?: string };
    }>;

    expect(body[0]?.data?.senderName).toBeUndefined();
  });

  it('includes sender metadata and preview text in the Expo push data payload', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification({
      ...BASE_PAYLOAD,
      metadata: {
        rawEventPayload: {
          channelId: 'channel-42',
          senderName: 'Priya',
          senderAvatarUrl: 'https://example.com/avatar.png',
          content: 'Hey, are we still meeting tomorrow?',
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Array<{
      data?: {
        senderName?: string;
        senderAvatarUrl?: string;
        preview?: string;
      };
    }>;

    expect(body[0]?.data?.senderName).toBe('Priya');
    expect(body[0]?.data?.senderAvatarUrl).toBe('https://example.com/avatar.png');
    expect(body[0]?.data?.preview).toBe('Hey, are we still meeting tomorrow?');
  });

  it('uses preview text as the notification body when summary is missing', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendPushNotification({
      ...BASE_PAYLOAD,
      summary: null,
      metadata: {
        rawEventPayload: {
          content: 'This is the actual DM body',
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Array<{
      body?: string;
      data?: { preview?: string };
    }>;

    expect(body[0]?.body).toBe('This is the actual DM body');
    expect(body[0]?.data?.preview).toBe('This is the actual DM body');
  });

  it('throws when the Expo API returns a non-ok status', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(sendPushNotification(BASE_PAYLOAD)).rejects.toThrow(
      'Expo Push API returned 500',
    );
  });

  it('throws for InvalidCredentials ticket errors', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'error', details: { error: 'InvalidCredentials' } }],
        }),
      }),
    );

    await expect(sendPushNotification(BASE_PAYLOAD)).rejects.toThrow(
      'Expo push InvalidCredentials - check EAS project push credentials',
    );
  });

  it('returns ticket ids for successful sends', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
      }),
    );

    await expect(sendPushNotification(BASE_PAYLOAD)).resolves.toEqual({
      ticketIds: ['ticket-1'],
      revokedTokenIds: [],
    });
  });

  it('revokes DeviceNotRegistered tokens after sending', async () => {
    setupSelectChain({
      data: [
        { id: 'tok-1', token: 'ExponentPushToken[aaa]' },
        { id: 'tok-2', token: 'ExponentPushToken[bbb]' },
      ],
      error: null,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { status: 'ok' },
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
          ],
        }),
      }),
    );

    await sendPushNotification(BASE_PAYLOAD);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) }),
    );
    expect(mockIn).toHaveBeenCalledWith('id', ['tok-2']);
  });

  it('does not call update when no tokens are DeviceNotRegistered', async () => {
    setupSelectChain({
      data: [{ id: 'tok-1', token: 'ExponentPushToken[aaa]' }],
      error: null,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      }),
    );

    await sendPushNotification(BASE_PAYLOAD);

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('pollExpoPushReceipts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns early with an empty receipt map when no ids are provided', async () => {
    await expect(pollExpoPushReceipts([])).resolves.toEqual({});
  });

  it('calls the Expo receipts endpoint with auth when configured', async () => {
    vi.stubEnv('EXPO_ACCESS_TOKEN', 'expo-token-456');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          'ticket-1': { status: 'ok' },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(pollExpoPushReceipts(['ticket-1'])).resolves.toEqual({
      'ticket-1': { status: 'ok' },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exp.host/--/api/v2/push/getReceipts');
    expect(init.body).toBe(JSON.stringify({ ids: ['ticket-1'] }));
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer expo-token-456',
    );
  });
});
