import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/messages/read-state/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const apiPost = vi.fn();
const requireEffectiveActorContext = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: vi.fn(() => ({ post: apiPost })),
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

describe('POST /api/messages/read-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
    });
    apiPost.mockResolvedValue({ unreadCount: 0 });
  });

  it('returns 400 when channelId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'channelId is required',
    });
  });

  it('proxies channel reads to the unified API read-state endpoint', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          lastReadMessageId: 'message-1',
        }),
      }),
    );

    expect(apiPost).toHaveBeenCalledWith('/channels/channel-1/read-state', {
      orgId: 'org-1',
      channelId: 'channel-1',
      threadId: null,
      accountId: 'account-1',
      profileId: 'profile-1',
      lastReadMessageId: 'message-1',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        success: true,
        unreadCount: 0,
        lastReadAt: expect.any(String),
        lastReadMessageId: 'message-1',
      }),
    );
  });

  it('proxies thread reads through the same API read-state endpoint', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          threadId: 'thread-1',
          lastReadMessageId: 'reply-1',
        }),
      }),
    );

    expect(apiPost).toHaveBeenCalledWith('/channels/channel-1/read-state', {
      orgId: 'org-1',
      channelId: 'channel-1',
      threadId: 'thread-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      lastReadMessageId: 'reply-1',
    });
    expect(response.status).toBe(200);
  });

  it('returns API errors as an unsuccessful response', async () => {
    apiPost.mockRejectedValueOnce(new Error('Channel not found or access denied'));

    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Channel not found or access denied',
    });
  });
});
