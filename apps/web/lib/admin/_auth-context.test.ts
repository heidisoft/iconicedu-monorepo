import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireAdminAuthContext } from './_auth-context';

const getUser = vi.fn();
const requireEffectiveActorContext = vi.fn();
const getUserRoles = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
  ParentModeRequiredError: class ParentModeRequiredError extends Error {},
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: (...args: unknown[]) => getUserRoles(...args),
}));

describe('requireAdminAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the resolved admin auth context', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
    });
    requireEffectiveActorContext.mockResolvedValue({
      authUserId: 'auth-user-1',
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
      isViewingAsChild: false,
    });
    getUserRoles.mockResolvedValue({
      data: [{ role_key: 'staff' }],
      error: null,
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

  it('throws when the user is not an admin manager', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
    });
    requireEffectiveActorContext.mockResolvedValue({
      authUserId: 'auth-user-1',
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
      isViewingAsChild: false,
    });
    getUserRoles.mockResolvedValue({
      data: [{ role_key: 'guardian' }],
      error: null,
    });

    await expect(requireAdminAuthContext()).rejects.toThrow('Forbidden');
  });
});
