import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/activity-feed/read/route';

const requireAuthedUser = vi.fn();
const getAccountByAuthUserId = vi.fn();
const getProfileByAccountId = vi.fn();
const createSupabaseServerClient = vi.fn();

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

describe('POST /api/activity-feed/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthedUser.mockResolvedValue({ id: 'auth-user-1' });
    getAccountByAuthUserId.mockResolvedValue({ data: { id: 'account-1', org_id: 'org-1' } });
    getProfileByAccountId.mockResolvedValue({ data: { id: 'profile-1' } });
  });

  it('marks only the current recipient rows as read', async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            is: vi.fn(async () => ({ error: null })),
          })),
        })),
      })),
    }));

    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    });

    const response = await POST(
      new Request('http://localhost/api/activity-feed/read', {
        method: 'POST',
        body: JSON.stringify({ ids: ['item-1', 'item-2'] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_read: true,
        updated_by: 'profile-1',
      }),
    );
  });
});
