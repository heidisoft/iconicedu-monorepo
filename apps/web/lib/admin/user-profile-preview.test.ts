import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServiceClientMock,
  getAccountByIdMock,
  requireAdminOrgContextMock,
  buildAccountByIdMock,
  buildUserProfileByAccountIdMock,
} = vi.hoisted(() => ({
  createSupabaseServiceClientMock: vi.fn(),
  getAccountByIdMock: vi.fn(),
  requireAdminOrgContextMock: vi.fn(),
  buildAccountByIdMock: vi.fn(),
  buildUserProfileByAccountIdMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountById: getAccountByIdMock,
}));

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContextMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/builders/account.builder', () => ({
  buildAccountById: (...args: unknown[]) => buildAccountByIdMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileByAccountId: (...args: unknown[]) =>
    buildUserProfileByAccountIdMock(...args),
}));

import { getAdminUserProfilePreview } from '@iconicedu/web/lib/admin/user-profile-preview';

describe('getAdminUserProfilePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when account id is blank', async () => {
    await expect(getAdminUserProfilePreview('   ')).resolves.toBeNull();
    expect(createSupabaseServiceClientMock).not.toHaveBeenCalled();
  });

  it('returns null when the account is missing', async () => {
    const supabase = {};
    createSupabaseServiceClientMock.mockReturnValue(supabase);
    getAccountByIdMock.mockResolvedValue({ data: null });

    await expect(getAdminUserProfilePreview('account-1')).resolves.toBeNull();
    expect(getAccountByIdMock).toHaveBeenCalledWith(supabase, 'account-1');
  });

  it('builds preview data for an admin-visible account', async () => {
    const supabase = {};
    createSupabaseServiceClientMock.mockReturnValue(supabase);
    getAccountByIdMock.mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
        email: 'person@example.com',
      },
    });
    requireAdminOrgContextMock.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-admin-1',
    });
    buildAccountByIdMock.mockResolvedValue({ ids: { id: 'account-1', orgId: 'org-1' } });
    buildUserProfileByAccountIdMock.mockResolvedValue({
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      kind: 'guardian',
      profile: {
        displayName: 'Jamie M',
        firstName: 'Jamie',
        lastName: 'M',
        avatar: { source: 'seed' },
      },
      prefs: {},
      meta: {
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    await expect(getAdminUserProfilePreview('account-1')).resolves.toMatchObject({
      account: { ids: { id: 'account-1', orgId: 'org-1' } },
      profile: { ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' } },
    });

    expect(requireAdminOrgContextMock).toHaveBeenCalledWith('org-1', {
      allowStaff: true,
    });
    expect(buildAccountByIdMock).toHaveBeenCalledWith(
      supabase,
      'account-1',
      'org-1',
      'person@example.com',
    );
    expect(buildUserProfileByAccountIdMock).toHaveBeenCalledWith(supabase, 'account-1', {
      accountEmail: 'person@example.com',
      includeFamilyInvites: true,
    });
  });
});
