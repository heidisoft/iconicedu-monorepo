import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServiceClientMock,
  requireAdminOrgContextMock,
  getAccountsByOrgIdMock,
  getFamilyLinksByOrgMock,
  getProfileSummariesByAccountIdsMock,
} = vi.hoisted(() => ({
  createSupabaseServiceClientMock: vi.fn(),
  requireAdminOrgContextMock: vi.fn(),
  getAccountsByOrgIdMock: vi.fn(),
  getFamilyLinksByOrgMock: vi.fn(),
  getProfileSummariesByAccountIdsMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: createSupabaseServiceClientMock,
}));

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContextMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountsByOrgId: getAccountsByOrgIdMock,
}));

vi.mock('@iconicedu/web/lib/family/queries/families.query', () => ({
  getFamilyLinksByOrg: getFamilyLinksByOrgMock,
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileSummariesByAccountIds: getProfileSummariesByAccountIdsMock,
}));

import { getAdminUserRows } from '@iconicedu/web/lib/admin/users';

describe('getAdminUserRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty rows when org id is missing', async () => {
    const rows = await getAdminUserRows('');

    expect(rows).toEqual([]);
    expect(createSupabaseServiceClientMock).not.toHaveBeenCalled();
  });

  it('throws when requester is not authorized for admin users', async () => {
    requireAdminOrgContextMock.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });

    await expect(getAdminUserRows('org-1')).rejects.toThrow('Forbidden');
    expect(createSupabaseServiceClientMock).not.toHaveBeenCalled();
  });

  it('loads users for the provided org id', async () => {
    const supabase = {};
    requireAdminOrgContextMock.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-actor-1',
    });
    createSupabaseServiceClientMock.mockReturnValue(supabase);
    getAccountsByOrgIdMock.mockResolvedValue({
      data: [
        {
          id: 'account-1',
          org_id: 'org-1',
          email: 'person@example.com',
          phone_e164: '+15555550123',
          status: 'active',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    getProfileSummariesByAccountIdsMock.mockResolvedValue({
      data: [
        {
          id: 'profile-1',
          org_id: 'org-1',
          account_id: 'account-1',
          kind: 'guardian',
          display_name: 'Jamie M',
          first_name: 'Jamie',
          last_name: 'M',
          avatar_url: null,
          avatar_source: 'seed',
          country_name: 'United States',
          timezone: 'America/New_York',
          ui_theme_key: 'teal',
        },
      ],
    });
    getFamilyLinksByOrgMock.mockResolvedValue({
      data: [
        {
          id: 'family-link-1',
          org_id: 'org-1',
          family_id: 'family-1',
          guardian_account_id: 'account-1',
          child_account_id: 'account-child-1',
          relation: 'parent',
        },
      ],
    });

    const rows = await getAdminUserRows('org-1');

    expect(requireAdminOrgContextMock).toHaveBeenCalledWith('org-1', {
      allowStaff: true,
    });
    expect(getAccountsByOrgIdMock).toHaveBeenCalledWith(supabase, 'org-1');
    expect(getProfileSummariesByAccountIdsMock).toHaveBeenCalledWith(supabase, 'org-1', [
      'account-1',
    ]);
    expect(getFamilyLinksByOrgMock).toHaveBeenCalledWith(supabase, 'org-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'account-1',
      orgId: 'org-1',
      email: 'person@example.com',
      profileKind: 'guardian',
      displayName: 'Jamie M',
      countryName: 'United States',
      timezone: 'America/New_York',
      linkedChildAccountIds: ['account-child-1'],
      linkedGuardianAccountIds: [],
    });
  });
});
