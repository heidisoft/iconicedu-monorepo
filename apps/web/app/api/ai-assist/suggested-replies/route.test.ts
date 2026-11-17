import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/ai-assist/suggested-replies/route';
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

describe('POST /api/ai-assist/suggested-replies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
    });
    apiPost.mockResolvedValue({ suggestions: ['Sounds good!', 'Thanks!'] });
  });

  it('returns 400 when channelId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/ai-assist/suggested-replies`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('proxies to the API with the resolved actor context', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/ai-assist/suggested-replies`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1' }),
      }),
    );

    expect(apiPost).toHaveBeenCalledWith('/ai-assist/suggested-replies', {
      orgId: 'org-1',
      channelId: 'channel-1',
      profileId: 'profile-1',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      suggestions: ['Sounds good!', 'Thanks!'],
    });
  });

  it('maps a channel-membership error from the API to a 403 response', async () => {
    apiPost.mockRejectedValueOnce(new Error('You are not a member of this channel'));

    const response = await POST(
      new Request(`${APP_URL}/api/ai-assist/suggested-replies`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1' }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
