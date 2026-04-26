import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/messages/thread-read-state/route';
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

describe('POST /api/messages/thread-read-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
    });
    apiPost.mockResolvedValue({ unreadCount: 0 });
  });

  it('returns 400 when threadId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/messages/thread-read-state`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'threadId is required',
    });
  });

  it('returns API errors as an unsuccessful response', async () => {
    apiPost.mockRejectedValueOnce(new Error('Thread not found or access denied'));

    const response = await POST(
      new Request(`${APP_URL}/api/messages/thread-read-state`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          threadId: 'thread-1',
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Thread not found or access denied',
    });
  });

  it('proxies to the API thread read endpoint and returns read-state response', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/messages/thread-read-state`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          threadId: 'thread-1',
          lastReadMessageId: 'message-2',
        }),
      }),
    );

    expect(apiPost).toHaveBeenCalledWith('/threads/thread-1/read', {
      orgId: 'org-1',
      channelId: 'channel-1',
      accountId: 'account-1',
      profileId: 'profile-1',
      lastReadMessageId: 'message-2',
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        unreadCount: 0,
        lastReadMessageId: 'message-2',
        lastReadAt: expect.any(String),
      }),
    );
  });
});
