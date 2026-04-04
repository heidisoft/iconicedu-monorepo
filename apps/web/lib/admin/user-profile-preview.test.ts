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
        email: 'iconicedudev+person@gmail.com',
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
      children: {
        items: [
          {
            ids: { id: 'child-profile-1', orgId: 'org-1', accountId: 'child-account-1' },
          },
        ],
      },
      familyInvites: [
        {
          id: 'invite-1',
          familyId: 'family-1',
          acceptedByAccountId: 'accepted-account-1',
          createdByAccountId: 'account-admin-1',
        },
      ],
      meta: {
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    await expect(getAdminUserProfilePreview('account-1')).resolves.toMatchObject({
      account: { ids: { id: 'account-1', orgId: 'org-1' } },
      profile: { ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' } },
      metadata: {
        accountId: 'account-1',
        accountOrgId: 'org-1',
        profileId: 'profile-1',
        profileOrgId: 'org-1',
        profileAccountId: 'account-1',
        childProfileIds: ['child-profile-1'],
        childAccountIds: ['child-account-1'],
        familyInviteIds: ['invite-1'],
        familyInviteFamilyIds: ['family-1'],
        familyInviteAcceptedByAccountIds: ['accepted-account-1'],
        familyInviteCreatedByAccountIds: ['account-admin-1'],
      },
    });

    expect(requireAdminOrgContextMock).toHaveBeenCalledWith('org-1', {
      allowStaff: true,
    });
    expect(buildAccountByIdMock).toHaveBeenCalledWith(
      supabase,
      'account-1',
      'org-1',
      'iconicedudev+person@gmail.com',
    );
    expect(buildUserProfileByAccountIdMock).toHaveBeenCalledWith(supabase, 'account-1', {
      accountEmail: 'iconicedudev+person@gmail.com',
      includeFamilyInvites: true,
    });
  });
});
