import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/activity-feed/unread-count/route';

const requireAuthedUser = vi.fn();
const getAccountByAuthUserId = vi.fn();
const getProfileByAccountId = vi.fn();
const createSupabaseServerClient = vi.fn();
const buildActivityFeedUnreadCountForProfile = vi.fn();

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: (...args: unknown[]) => requireAuthedUser(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: (...args: unknown[]) => getAccountByAuthUserId(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: (...args: unknown[]) => getProfileByAccountId(...args),
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
    requireAuthedUser.mockResolvedValue({ id: 'auth-user-1' });
    getAccountByAuthUserId.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    getProfileByAccountId.mockResolvedValue({ data: { id: 'profile-1' } });
    buildActivityFeedUnreadCountForProfile.mockResolvedValue(3);
  });

  it('returns unread count for the authenticated profile', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(buildActivityFeedUnreadCountForProfile).toHaveBeenCalledWith(
      {},
      'org-1',
      'profile-1',
    );
    expect(payload).toEqual({ unreadCount: 3 });
  });
});
