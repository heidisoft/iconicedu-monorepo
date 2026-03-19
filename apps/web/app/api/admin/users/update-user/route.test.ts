import { describe, expect, it, vi, beforeEach } from 'vitest';

import { POST } from '@iconicedu/web/app/api/admin/users/update-user/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const updateUserById = vi.fn();
const getFamilyInviteAdminClient = vi.fn();
const upsertUserRole = vi.fn();
const requireAdminOrgContext = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/family/queries/invite.query', () => ({
  getFamilyInviteAdminClient: () => getFamilyInviteAdminClient(),
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  upsertUserRole: (...args: unknown[]) => upsertUserRole(...args),
}));

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContext(...args),
}));

describe('POST /api/admin/users/update-user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertUserRole.mockResolvedValue({ error: null });
    requireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-staff-1',
    });
  });

  it('returns 400 when accountId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/admin/users/update-user`, {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'accountId is required',
    });
  });

  it('returns 400 when email is invalid', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/admin/users/update-user`, {
        method: 'POST',
        body: JSON.stringify({ accountId: 'account-1', email: 'bad-email' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Valid email is required',
    });
  });

  it('updates account auth user and profile fields', async () => {
    const accountsUpdateEqOrgId = vi.fn(async () => ({ error: null }));
    const accountsUpdateEqId = vi.fn(() => ({ eq: accountsUpdateEqOrgId }));
    const accountsUpdate = vi.fn(() => ({ eq: accountsUpdateEqId }));
    const profilesUpdateEqOrgId = vi.fn(() => ({
      is: vi.fn(async () => ({ error: null })),
    }));
    const profilesUpdateEqAccountId = vi.fn(() => ({ eq: profilesUpdateEqOrgId }));
    const profilesUpdate = vi.fn(() => ({ eq: profilesUpdateEqAccountId }));
    const accountsConflictMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const accountsConflictLimit = vi.fn(() => ({
      maybeSingle: accountsConflictMaybeSingle,
    }));
    const accountsConflictIs = vi.fn(() => ({ limit: accountsConflictLimit }));
    const accountsConflictNeq = vi.fn(() => ({ is: accountsConflictIs }));
    const accountsConflictIlike = vi.fn(() => ({ neq: accountsConflictNeq }));
    const accountsConflictEqOrg = vi.fn(() => ({ ilike: accountsConflictIlike }));
    const accountsLookupMaybeSingle = vi.fn(async () => ({
      data: {
        id: 'account-1',
        org_id: 'org-1',
        auth_user_id: 'auth-1',
        email: 'old@example.com',
      },
      error: null,
    }));
    const accountsLookupLimit = vi.fn(() => ({ maybeSingle: accountsLookupMaybeSingle }));
    const accountsLookupIs = vi.fn(() => ({ limit: accountsLookupLimit }));
    const accountsLookupEqId = vi.fn(() => ({ is: accountsLookupIs }));

    const accountSelect = vi
      .fn()
      .mockImplementationOnce(() => ({ eq: accountsLookupEqId }))
      .mockImplementationOnce(() => ({ eq: accountsConflictEqOrg }));

    getFamilyInviteAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'accounts') {
          return {
            select: accountSelect,
            update: accountsUpdate,
          };
        }
        if (table === 'profiles') {
          return {
            update: profilesUpdate,
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      auth: {
        admin: {
          updateUserById,
        },
      },
    });
    updateUserById.mockResolvedValue({ error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/admin/users/update-user`, {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'account-1',
          email: 'new@example.com',
          displayName: 'New Name',
          firstName: 'New',
          lastName: 'Name',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(accountsUpdate).toHaveBeenCalledWith({
      email: 'new@example.com',
      primary_role: null,
      role_status: 'unassigned',
    });
    expect(updateUserById).toHaveBeenCalledWith('auth-1', { email: 'new@example.com' });
    expect(profilesUpdate).toHaveBeenCalledWith({
      display_name: 'New Name',
      first_name: 'New',
      last_name: 'Name',
    });
  });

  it('upserts role when role is approved as active', async () => {
    const accountsUpdateEqOrgId = vi.fn(async () => ({ error: null }));
    const accountsUpdateEqId = vi.fn(() => ({ eq: accountsUpdateEqOrgId }));
    const accountsUpdate = vi.fn(() => ({ eq: accountsUpdateEqId }));
    const profilesUpdateEqOrgId = vi.fn(() => ({
      is: vi.fn(async () => ({ error: null })),
    }));
    const profilesUpdateEqAccountId = vi.fn(() => ({ eq: profilesUpdateEqOrgId }));
    const profilesUpdate = vi.fn(() => ({ eq: profilesUpdateEqAccountId }));
    const accountsConflictMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const accountsConflictLimit = vi.fn(() => ({
      maybeSingle: accountsConflictMaybeSingle,
    }));
    const accountsConflictIs = vi.fn(() => ({ limit: accountsConflictLimit }));
    const accountsConflictNeq = vi.fn(() => ({ is: accountsConflictIs }));
    const accountsConflictIlike = vi.fn(() => ({ neq: accountsConflictNeq }));
    const accountsConflictEqOrg = vi.fn(() => ({ ilike: accountsConflictIlike }));
    const accountsLookupMaybeSingle = vi.fn(async () => ({
      data: {
        id: 'account-1',
        org_id: 'org-1',
        auth_user_id: 'auth-1',
        email: 'old@example.com',
      },
      error: null,
    }));
    const accountsLookupLimit = vi.fn(() => ({ maybeSingle: accountsLookupMaybeSingle }));
    const accountsLookupIs = vi.fn(() => ({ limit: accountsLookupLimit }));
    const accountsLookupEqId = vi.fn(() => ({ is: accountsLookupIs }));

    const accountSelect = vi
      .fn()
      .mockImplementationOnce(() => ({ eq: accountsLookupEqId }))
      .mockImplementationOnce(() => ({ eq: accountsConflictEqOrg }));

    getFamilyInviteAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'accounts') {
          return {
            select: accountSelect,
            update: accountsUpdate,
          };
        }
        if (table === 'profiles') {
          return {
            update: profilesUpdate,
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      auth: {
        admin: {
          updateUserById,
        },
      },
    });
    updateUserById.mockResolvedValue({ error: null });
    upsertUserRole.mockResolvedValueOnce({ error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/admin/users/update-user`, {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'account-1',
          email: 'new@example.com',
          primaryRole: 'educator',
          roleStatus: 'active',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(accountsUpdate).toHaveBeenCalledWith({
      email: 'new@example.com',
      primary_role: 'educator',
      role_status: 'active',
    });
    expect(upsertUserRole).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'org-1',
      accountId: 'account-1',
      roleKey: 'educator',
      assignedBy: 'auth-1',
    });
  });

  it('returns 409 when email already exists in org', async () => {
    const accountsLookupMaybeSingle = vi.fn(async () => ({
      data: {
        id: 'account-1',
        org_id: 'org-1',
        auth_user_id: null,
        email: 'old@example.com',
      },
      error: null,
    }));
    const accountsLookupLimit = vi.fn(() => ({ maybeSingle: accountsLookupMaybeSingle }));
    const accountsLookupIs = vi.fn(() => ({ limit: accountsLookupLimit }));
    const accountsLookupEqId = vi.fn(() => ({ is: accountsLookupIs }));

    const accountsConflictMaybeSingle = vi.fn(async () => ({
      data: { id: 'account-2' },
      error: null,
    }));
    const accountsConflictLimit = vi.fn(() => ({
      maybeSingle: accountsConflictMaybeSingle,
    }));
    const accountsConflictIs = vi.fn(() => ({ limit: accountsConflictLimit }));
    const accountsConflictNeq = vi.fn(() => ({ is: accountsConflictIs }));
    const accountsConflictIlike = vi.fn(() => ({ neq: accountsConflictNeq }));
    const accountsConflictEqOrg = vi.fn(() => ({ ilike: accountsConflictIlike }));

    const accountSelect = vi
      .fn()
      .mockImplementationOnce(() => ({ eq: accountsLookupEqId }))
      .mockImplementationOnce(() => ({ eq: accountsConflictEqOrg }));

    getFamilyInviteAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'accounts') {
          return {
            select: accountSelect,
            update: vi.fn(),
          };
        }
        if (table === 'profiles') {
          return { update: vi.fn() };
        }
        throw new Error(`unexpected table ${table}`);
      },
      auth: {
        admin: {
          updateUserById,
        },
      },
    });

    const response = await POST(
      new Request(`${APP_URL}/api/admin/users/update-user`, {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'account-1',
          email: 'taken@example.com',
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Email is already used by another account',
    });
  });

  it('returns auth error when actor cannot manage org users', async () => {
    requireAdminOrgContext.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });

    const accountsLookupMaybeSingle = vi.fn(async () => ({
      data: {
        id: 'account-1',
        org_id: 'org-1',
        auth_user_id: null,
        email: 'old@example.com',
      },
      error: null,
    }));
    const accountsLookupLimit = vi.fn(() => ({ maybeSingle: accountsLookupMaybeSingle }));
    const accountsLookupIs = vi.fn(() => ({ limit: accountsLookupLimit }));
    const accountsLookupEqId = vi.fn(() => ({ is: accountsLookupIs }));

    getFamilyInviteAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'accounts') {
          return {
            select: vi.fn(() => ({ eq: accountsLookupEqId })),
            update: vi.fn(),
          };
        }
        if (table === 'profiles') {
          return { update: vi.fn() };
        }
        throw new Error(`unexpected table ${table}`);
      },
      auth: {
        admin: {
          updateUserById,
        },
      },
    });

    const response = await POST(
      new Request(`${APP_URL}/api/admin/users/update-user`, {
        method: 'POST',
        body: JSON.stringify({
          accountId: 'account-1',
          email: 'user@example.com',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Forbidden',
    });
  });
});
