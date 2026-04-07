import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendPushNotification } from '@iconicedu/web/lib/notifications/providers/push-provider';

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
