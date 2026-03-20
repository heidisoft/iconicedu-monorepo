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
  enablePersonaSwitchRun,
} = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthedUser: vi.fn(),
  getAccountByAuthUserIdInOrg: vi.fn(),
  getUserRoles: vi.fn(),
  getProfileById: vi.fn(),
  getProfilesByAccountId: vi.fn(),
  updateAccountActiveProfile: vi.fn(),
  revalidatePath: vi.fn(),
  enablePersonaSwitchRun: vi.fn(),
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
vi.mock('@iconicedu/web/flags', () => ({
  enablePersonaSwitch: {
    run: (...args: unknown[]) => enablePersonaSwitchRun(...args),
  },
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
    enablePersonaSwitchRun.mockReset();

    createSupabaseServerClient.mockResolvedValue({} as never);
    requireAuthedUser.mockResolvedValue({ id: 'auth-1' });
    getAccountByAuthUserIdInOrg.mockResolvedValue({
      data: { id: 'account-1', primary_role: 'guardian', active_profile_id: 'profile-1' },
    });
  });

  it('blocks switching when feature flag is disabled', async () => {
    enablePersonaSwitchRun.mockResolvedValue(false);

    await expect(
      switchActivePersonaAction({
        orgId: 'org-1',
        orgSlug: 'iconic-academy',
        profileId: 'profile-2',
      }),
    ).rejects.toThrow('Persona switch is disabled.');
  });

  it('does not log debug context when persona switch is blocked', async () => {
    process.env.DEBUG_POSTHOG_FLAGS = 'true';
    enablePersonaSwitchRun.mockResolvedValue(false);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(
      switchActivePersonaAction({
        orgId: 'org-1',
        orgSlug: 'iconic-academy',
        profileId: 'profile-2',
      }),
    ).rejects.toThrow('Persona switch is disabled.');

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('switches active persona when feature flag and role checks pass', async () => {
    enablePersonaSwitchRun.mockResolvedValue(true);
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
});
