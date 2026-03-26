import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClient,
  requireAuthedUser,
  getAccountByAuthUserIdInOrg,
  getUserRoles,
  getProfileById,
  getProfilesByAccountId,
  updateAccountActiveProfile,
  revalidatePath,
} = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthedUser: vi.fn(),
  getAccountByAuthUserIdInOrg: vi.fn(),
  getUserRoles: vi.fn(),
  getProfileById: vi.fn(),
  getProfilesByAccountId: vi.fn(),
  updateAccountActiveProfile: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient,
}));
vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser,
}));
vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserIdInOrg,
  updateAccountActiveProfile,
}));
vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles,
}));
vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileById,
  getProfilesByAccountId,
}));
vi.mock('next/cache', () => ({
  revalidatePath,
}));

import { switchActivePersonaAction } from './switch-active-persona';

describe('switchActivePersonaAction', () => {
  beforeEach(() => {
    delete process.env.DEBUG_POSTHOG_FLAGS;
  });

  beforeEach(() => {
    createSupabaseServerClient.mockReset();
    requireAuthedUser.mockReset();
    getAccountByAuthUserIdInOrg.mockReset();
    getUserRoles.mockReset();
    getProfileById.mockReset();
    getProfilesByAccountId.mockReset();
    updateAccountActiveProfile.mockReset();
    revalidatePath.mockReset();

    createSupabaseServerClient.mockResolvedValue({} as never);
    requireAuthedUser.mockResolvedValue({ id: 'auth-1' });
    getAccountByAuthUserIdInOrg.mockResolvedValue({
      data: { id: 'account-1', primary_role: 'guardian', active_profile_id: 'profile-1' },
    });
  });

  it('switches active persona when role checks pass', async () => {
    getProfileById.mockResolvedValue({
      data: {
        id: 'profile-2',
        org_id: 'org-1',
        account_id: 'account-1',
        kind: 'guardian',
      },
    });
    getUserRoles.mockResolvedValue({ data: [{ role_key: 'guardian' }] });
    updateAccountActiveProfile.mockResolvedValue({ error: null });

    const result = await switchActivePersonaAction({
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      profileId: 'profile-2',
    });

    expect(result.success).toBe(true);
    expect(updateAccountActiveProfile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accountId: 'account-1',
        orgId: 'org-1',
        activeProfileId: 'profile-2',
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/iconic-academy');
  });

  it('rejects switching when the target profile is not available for the account', async () => {
    getProfileById.mockResolvedValue({
      data: {
        id: 'profile-2',
        org_id: 'org-1',
        account_id: 'account-2',
        kind: 'guardian',
      },
    });

    await expect(
      switchActivePersonaAction({
        orgId: 'org-1',
        orgSlug: 'iconic-academy',
        profileId: 'profile-2',
      }),
    ).rejects.toThrow('Profile is not available for this account.');
  });

  it('rejects switching when the required role is not assigned', async () => {
    getProfileById.mockResolvedValue({
      data: {
        id: 'profile-2',
        org_id: 'org-1',
        account_id: 'account-1',
        kind: 'educator',
      },
    });
    getUserRoles.mockResolvedValue({ data: [{ role_key: 'guardian' }] });

    await expect(
      switchActivePersonaAction({
        orgId: 'org-1',
        orgSlug: 'iconic-academy',
        profileId: 'profile-2',
      }),
    ).rejects.toThrow('Required role is not assigned for this persona.');
  });
});
