import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inviteAdminUserAction } from './invite-user';

const {
  mockHeaders,
  mockCreateSupabaseServerClient,
  mockGetAccountByAuthUserId,
  mockGetAccountByEmail,
  mockInsertInvitedAccount,
  mockUpdateAccountStatus,
  mockUpdateAccountRoleState,
  mockUpsertProfileForAccount,
  mockInsertProfileForAccount,
  mockUpsertUserRole,
  mockGetFamilyInviteAdminClient,
  mockGetOrgById,
  mockInviteUserByEmail,
  mockGenerateLink,
  mockRequireAdminOrgContext,
} = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockCreateSupabaseServerClient: vi.fn(),
  mockGetAccountByAuthUserId: vi.fn(),
  mockGetAccountByEmail: vi.fn(),
  mockInsertInvitedAccount: vi.fn(),
  mockUpdateAccountStatus: vi.fn(),
  mockUpdateAccountRoleState: vi.fn(),
  mockUpsertProfileForAccount: vi.fn(),
  mockInsertProfileForAccount: vi.fn(),
  mockUpsertUserRole: vi.fn(),
  mockGetFamilyInviteAdminClient: vi.fn(),
  mockGetOrgById: vi.fn(),
  mockInviteUserByEmail: vi.fn(),
  mockGenerateLink: vi.fn(),
  mockRequireAdminOrgContext: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: mockGetAccountByAuthUserId,
  getAccountByEmail: mockGetAccountByEmail,
  insertInvitedAccount: mockInsertInvitedAccount,
  updateAccountStatus: mockUpdateAccountStatus,
  updateAccountRoleState: mockUpdateAccountRoleState,
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  upsertProfileForAccount: mockUpsertProfileForAccount,
  insertProfileForAccount: mockInsertProfileForAccount,
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  upsertUserRole: mockUpsertUserRole,
}));

vi.mock('@iconicedu/web/lib/profile/constants/theme', () => ({
  pickRandomThemeKey: vi.fn(() => 'teal'),
}));

vi.mock('@iconicedu/web/lib/config/app-url', () => ({
  resolveAppUrl: vi.fn(() => 'http://localhost:3000'),
}));

vi.mock(
  '@iconicedu/web/app/(app)/[orgSlug]/admin/users/actions/invite-user.utils',
  () => ({
    buildOrgInviteRedirectUrl: vi.fn(
      ({
        baseUrl,
        profileKind,
        orgSlug,
        intent,
      }: {
        baseUrl: string;
        profileKind: string;
        orgSlug: string;
        intent?: 'login' | 'get-started';
      }) =>
        `${baseUrl}/auth/callback?profileKind=${profileKind}&org=${orgSlug}&intent=${intent ?? 'login'}`,
    ),
    ensureOrgCallbackRedirect: vi.fn(
      (
        redirectTo: string,
        orgSlug: string,
        intent: 'login' | 'get-started' = 'get-started',
      ) =>
        `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}org=${orgSlug}&intent=${intent}`,
    ),
  }),
);

vi.mock('@iconicedu/web/lib/family/queries/invite.query', () => ({
  getFamilyInviteAdminClient: mockGetFamilyInviteAdminClient,
}));

vi.mock('@iconicedu/web/lib/org/queries/org.query', () => ({
  getOrgById: mockGetOrgById,
}));

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => mockRequireAdminOrgContext(...args),
}));

describe('inviteAdminUserAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockHeaders.mockResolvedValue(
      new Headers({
        host: 'localhost:3000',
        'x-forwarded-proto': 'http',
      }),
    );
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'auth-admin-1' } },
        }),
      },
    });
    mockGetAccountByAuthUserId.mockResolvedValue({
      data: { id: 'account-admin-1', org_id: 'org-1' },
    });
    mockRequireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-staff-1',
    });
    mockGetOrgById.mockResolvedValue({
      error: null,
      data: { id: 'org-1', slug: 'iconic-academy' },
    });
    mockGetAccountByEmail.mockResolvedValue({
      error: null,
      data: null,
    });
    mockInsertInvitedAccount.mockResolvedValue({
      error: null,
      data: { id: 'account-invited-1', org_id: 'org-1', status: 'invited' },
    });
    mockUpdateAccountStatus.mockResolvedValue({
      error: null,
      data: { id: 'account-invited-1', org_id: 'org-1', status: 'invited' },
    });
    mockUpsertProfileForAccount.mockResolvedValue({
      error: null,
      data: { id: 'profile-1' },
    });
    mockInsertProfileForAccount.mockResolvedValue({
      error: null,
      data: { id: 'profile-1' },
    });
    mockUpsertUserRole.mockResolvedValue({
      error: null,
      data: { id: 'role-1' },
    });
    mockUpdateAccountRoleState.mockResolvedValue({
      error: null,
      data: {
        id: 'account-invited-1',
        org_id: 'org-1',
        primary_role: 'guardian',
        role_status: 'active',
        onboarding_completed_at: new Date().toISOString(),
      },
    });
    mockInviteUserByEmail.mockResolvedValue({ error: null });
    mockGenerateLink.mockResolvedValue({
      error: null,
      data: {
        properties: {
          action_link: 'http://localhost:3000/auth/callback?token=invite',
        },
      },
    });

    const accountsUpdateIs = vi.fn(async () => ({ error: null }));
    const accountsUpdateEqOrg = vi.fn(() => ({ is: accountsUpdateIs }));
    const accountsUpdateEqId = vi.fn(() => ({ eq: accountsUpdateEqOrg }));
    const accountsUpdate = vi.fn(() => ({ eq: accountsUpdateEqId }));

    const accountsDeleteIs = vi.fn(async () => ({ error: null }));
    const accountsDeleteNeq = vi.fn(() => ({ is: accountsDeleteIs }));
    const accountsDeleteNot = vi.fn(() => ({ neq: accountsDeleteNeq }));
    const accountsDeleteIlike = vi.fn(() => ({ not: accountsDeleteNot }));
    const accountsDeleteEq = vi.fn(() => ({ ilike: accountsDeleteIlike }));
    const accountsDelete = vi.fn(() => ({ eq: accountsDeleteEq }));

    mockGetFamilyInviteAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table !== 'accounts') {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          update: accountsUpdate,
          delete: accountsDelete,
        };
      },
      auth: {
        admin: {
          inviteUserByEmail: mockInviteUserByEmail,
          generateLink: mockGenerateLink,
        },
      },
    });
  });

  it.each([
    ['guardian', 'guardian'],
    ['educator', 'educator'],
    ['staff', 'staff'],
  ] as const)(
    'sends Supabase invite email and preassigns %s role',
    async (profileKind, expectedRole) => {
      mockUpdateAccountRoleState.mockResolvedValueOnce({
        error: null,
        data: {
          id: 'account-invited-1',
          org_id: 'org-1',
          primary_role: expectedRole,
          role_status: 'active',
          onboarding_completed_at: new Date().toISOString(),
        },
      });

      const formData = new FormData();
      formData.set('email', 'invitee@example.com');
      formData.set('profileKind', profileKind);
      formData.set('mode', 'invite');
      formData.set('linkType', 'invite');

      const result = await inviteAdminUserAction(formData);

      expect(mockInviteUserByEmail).toHaveBeenCalledWith('invitee@example.com', {
        redirectTo:
          'http://localhost:3000/auth/callback?profileKind=' +
          profileKind +
          '&org=iconic-academy&intent=get-started',
      });
      expect(mockGenerateLink).toHaveBeenCalledWith({
        type: 'invite',
        email: 'invitee@example.com',
        options: {
          redirectTo:
            'http://localhost:3000/auth/callback?profileKind=' +
            profileKind +
            '&org=iconic-academy&intent=get-started',
        },
      });
      expect(mockUpsertUserRole).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          orgId: 'org-1',
          accountId: 'account-invited-1',
          roleKey: expectedRole,
          assignedBy: 'account-admin-1',
        }),
      );
      expect(mockUpdateAccountRoleState).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          accountId: 'account-invited-1',
          orgId: 'org-1',
          primaryRole: expectedRole,
          roleStatus: 'active',
          updatedBy: 'account-admin-1',
        }),
      );
      expect(result.actionLink).toBe('http://localhost:3000/auth/callback?token=invite');
    },
  );

  it('rejects invite flow for already active accounts', async () => {
    mockGetAccountByEmail.mockResolvedValueOnce({
      error: null,
      data: {
        id: 'account-active-1',
        org_id: 'org-1',
        status: 'active',
      },
    });

    const formData = new FormData();
    formData.set('email', 'active@example.com');
    formData.set('profileKind', 'guardian');
    formData.set('mode', 'invite');
    formData.set('linkType', 'invite');

    await expect(inviteAdminUserAction(formData)).rejects.toThrow(
      'Account already active; use Generate a login link instead.',
    );
    expect(mockInviteUserByEmail).not.toHaveBeenCalled();
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });
});
