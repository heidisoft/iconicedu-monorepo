import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClient,
  requireAuthedUser,
  getAccountByAuthUserIdInOrg,
  getUserRoles,
  getProfilesByAccountId,
  insertProfileForAccount,
  revalidatePath,
  enablePersonaAddRun,
} = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthedUser: vi.fn(),
  getAccountByAuthUserIdInOrg: vi.fn(),
  getUserRoles: vi.fn(),
  getProfilesByAccountId: vi.fn(),
  insertProfileForAccount: vi.fn(),
  revalidatePath: vi.fn(),
  enablePersonaAddRun: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient,
}));
vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser,
}));
vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserIdInOrg,
}));
vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles,
}));
vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByAccountId,
  insertProfileForAccount,
}));
vi.mock('next/cache', () => ({
  revalidatePath,
}));
vi.mock('@iconicedu/web/flags', () => ({
  enablePersonaAdd: {
    run: (...args: unknown[]) => enablePersonaAddRun(...args),
  },
}));

import { addPersonaAction } from './add-persona';

describe('addPersonaAction', () => {
  beforeEach(() => {
    createSupabaseServerClient.mockReset();
    requireAuthedUser.mockReset();
    getAccountByAuthUserIdInOrg.mockReset();
    getUserRoles.mockReset();
    getProfilesByAccountId.mockReset();
    insertProfileForAccount.mockReset();
    revalidatePath.mockReset();
    enablePersonaAddRun.mockReset();

    createSupabaseServerClient.mockResolvedValue({} as never);
    requireAuthedUser.mockResolvedValue({ id: 'auth-1' });
    getAccountByAuthUserIdInOrg.mockResolvedValue({
      data: { id: 'account-1', primary_role: 'guardian', active_profile_id: 'profile-1' },
    });
  });

  it('blocks persona creation when feature flag is disabled', async () => {
    enablePersonaAddRun.mockResolvedValue(false);

    await expect(
      addPersonaAction({
        orgId: 'org-1',
        orgSlug: 'iconic-academy',
        kind: 'educator',
      }),
    ).rejects.toThrow('Persona add is disabled.');
  });

  it('creates persona profile when flag and role checks pass', async () => {
    enablePersonaAddRun.mockResolvedValue(true);
    getUserRoles.mockResolvedValue({ data: [{ role_key: 'educator' }] });
    getProfilesByAccountId.mockResolvedValue({
      data: [
        {
          id: 'profile-1',
          kind: 'guardian',
          display_name: 'Parent One',
          avatar_source: 'seed',
          avatar_url: null,
          avatar_seed: 'avatar-seed',
          timezone: 'UTC',
          locale: 'en-US',
          status: 'active',
          ui_theme_key: 'teal',
        },
      ],
    });
    insertProfileForAccount.mockResolvedValue({
      data: { id: 'profile-2', kind: 'educator' },
      error: null,
    });

    const result = await addPersonaAction({
      orgId: 'org-1',
      orgSlug: 'iconic-academy',
      kind: 'educator',
    });

    expect(result.success).toBe(true);
    expect(insertProfileForAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: 'org-1',
        accountId: 'account-1',
        kind: 'educator',
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/iconic-academy');
  });
});
