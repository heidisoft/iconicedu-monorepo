import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/activity-feed/unread-count/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const requireEffectiveActorContext = vi.fn();
const createSupabaseServerClient = vi.fn();
const buildActivityFeedUnreadCountForProfile = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

vi.mock('@iconicedu/web/lib/activity-feed/builders/activity-feed.builder', () => ({
  buildActivityFeedUnreadCountForProfile: (...args: unknown[]) =>
    buildActivityFeedUnreadCountForProfile(...args),
}));

describe('GET /api/activity-feed/unread-count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClient.mockResolvedValue({});
    requireEffectiveActorContext.mockResolvedValue({
      authUserId: 'auth-user-1',
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
      isViewingAsChild: false,
    });
    buildActivityFeedUnreadCountForProfile.mockResolvedValue(3);
  });

  it('returns unread count for the authenticated profile', async () => {
    const response = await GET(new Request(`${APP_URL}/api/activity-feed/unread-count`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(buildActivityFeedUnreadCountForProfile).toHaveBeenCalledWith(
      {},
      'org-1',
      'profile-1',
    );
    expect(payload).toEqual({ unreadCount: 3 });
  });

  it('returns 401 when actor resolution fails', async () => {
    requireEffectiveActorContext.mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await GET(new Request(`${APP_URL}/api/activity-feed/unread-count`));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
  });

  it('passes orgId to actor resolution when provided', async () => {
    await GET(new Request(`${APP_URL}/api/activity-feed/unread-count?orgId=org-2`));

    expect(requireEffectiveActorContext).toHaveBeenCalledWith({}, { orgId: 'org-2' });
  });
});
