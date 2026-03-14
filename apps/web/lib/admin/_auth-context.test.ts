import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireAdminAuthContext } from './_auth-context';

const getUser = vi.fn();
const getAccountByAuthUserId = vi.fn();
const getProfileByAccountId = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: (...args: unknown[]) => getAccountByAuthUserId(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: (...args: unknown[]) => getProfileByAccountId(...args),
}));

describe('requireAdminAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the resolved admin auth context', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
    });
    getAccountByAuthUserId.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    getProfileByAccountId.mockResolvedValue({
      data: { id: 'profile-1' },
    });

    const result = await requireAdminAuthContext();

    expect(result.accountId).toBe('account-1');
    expect(result.orgId).toBe('org-1');
    expect(result.profileId).toBe('profile-1');
    expect(result.now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws when no authenticated user exists', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
    });

    await expect(requireAdminAuthContext()).rejects.toThrow('Unauthorized');
  });
});
