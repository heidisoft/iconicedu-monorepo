import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSupabaseServerClientMock,
  getAccountsByOrgIdMock,
  getProfileSummariesByAccountIdsMock,
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  getAccountsByOrgIdMock: vi.fn(),
  getProfileSummariesByAccountIdsMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountsByOrgId: getAccountsByOrgIdMock,
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
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it('loads users for the provided org id', async () => {
    const supabase = {};
    createSupabaseServerClientMock.mockResolvedValue(supabase);
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
          ui_theme_key: 'teal',
        },
      ],
    });

    const rows = await getAdminUserRows('org-1');

    expect(getAccountsByOrgIdMock).toHaveBeenCalledWith(supabase, 'org-1');
    expect(getProfileSummariesByAccountIdsMock).toHaveBeenCalledWith(supabase, 'org-1', [
      'account-1',
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'account-1',
      orgId: 'org-1',
      email: 'person@example.com',
      profileKind: 'guardian',
      displayName: 'Jamie M',
    });
  });
});
