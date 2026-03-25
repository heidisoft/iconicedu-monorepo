import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClient,
  requireAuthedUser,
  getAccountByAuthUserIdInOrg,
  getUserRoles,
  getProfilesByAccountId,
  insertProfileForAccount,
  revalidatePath,
} = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAuthedUser: vi.fn(),
  getAccountByAuthUserIdInOrg: vi.fn(),
  getUserRoles: vi.fn(),
  getProfilesByAccountId: vi.fn(),
  insertProfileForAccount: vi.fn(),
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

import { addPersonaAction } from './add-persona';

describe('addPersonaAction', () => {
  beforeEach(() => {
    delete process.env.DEBUG_POSTHOG_FLAGS;
  });

  beforeEach(() => {
    createSupabaseServerClient.mockReset();
    requireAuthedUser.mockReset();
    getAccountByAuthUserIdInOrg.mockReset();
    getUserRoles.mockReset();
    getProfilesByAccountId.mockReset();
    insertProfileForAccount.mockReset();
    revalidatePath.mockReset();

    createSupabaseServerClient.mockResolvedValue({} as never);
    requireAuthedUser.mockResolvedValue({ id: 'auth-1' });
    getAccountByAuthUserIdInOrg.mockResolvedValue({
      data: { id: 'account-1', primary_role: 'guardian', active_profile_id: 'profile-1' },
    });
  });

  it('creates persona profile when role checks pass', async () => {
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

  it('rejects persona creation when the required role is missing', async () => {
    getUserRoles.mockResolvedValue({ data: [{ role_key: 'guardian' }] });

    await expect(
      addPersonaAction({
        orgId: 'org-1',
        orgSlug: 'iconic-academy',
        kind: 'educator',
      }),
    ).rejects.toThrow('Required role is not assigned for this persona.');
  });

  it('rejects persona creation when the persona already exists', async () => {
    getUserRoles.mockResolvedValue({ data: [{ role_key: 'educator' }] });
    getProfilesByAccountId.mockResolvedValue({
      data: [
        {
          id: 'profile-1',
          kind: 'guardian',
        },
        {
          id: 'profile-2',
          kind: 'educator',
        },
      ],
    });

    await expect(
      addPersonaAction({
        orgId: 'org-1',
        orgSlug: 'iconic-academy',
        kind: 'educator',
      }),
    ).rejects.toThrow('Persona already exists for this account.');
  });
});
