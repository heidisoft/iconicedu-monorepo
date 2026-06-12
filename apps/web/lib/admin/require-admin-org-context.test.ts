import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';

const requireEffectiveActorContext = vi.fn();
const getUserRoles = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: (...args: unknown[]) => getUserRoles(...args),
}));

describe('requireAdminOrgContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
      isViewingAsChild: false,
    });
    getUserRoles.mockResolvedValue({
      data: [{ role_key: 'staff' }],
      error: null,
    });
  });

  it('allows staff admin access by default', async () => {
    await expect(requireAdminOrgContext('org-1')).resolves.toMatchObject({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-1',
    });
  });

  it('rejects non-admin roles', async () => {
    getUserRoles.mockResolvedValueOnce({
      data: [{ role_key: 'guardian' }],
      error: null,
    });

    await expect(requireAdminOrgContext('org-1')).resolves.toEqual({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });
  });
});
