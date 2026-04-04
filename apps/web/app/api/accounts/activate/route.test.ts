import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';
const APP_URL = 'http://localhost:3000';
const {
  mockSessionGetUser,
  mockGetAccountByAuthUserId,
  mockGetAccountByAuthUserIdInOrg,
  mockGetAccountByEmail,
  mockInsertAccountForAuthUser,
  mockUpdateAccountAuthUserId,
  mockUpdateAccountStatus,
  mockGetProfileByAccountId,
  mockInsertProfileForAccount,
  mockGetUserRoles,
  mockGetOrgBySlug,
  mockResolveOrgDashboardPath,
  mockResolveOrgLoginPath,
} = vi.hoisted(() => ({
  mockSessionGetUser: vi.fn(),
  mockGetAccountByAuthUserId: vi.fn(),
  mockGetAccountByAuthUserIdInOrg: vi.fn(),
  mockGetAccountByEmail: vi.fn(),
  mockInsertAccountForAuthUser: vi.fn(),
  mockUpdateAccountAuthUserId: vi.fn(),
  mockUpdateAccountStatus: vi.fn(),
  mockGetProfileByAccountId: vi.fn(),
  mockInsertProfileForAccount: vi.fn(),
  mockGetUserRoles: vi.fn(),
  mockGetOrgBySlug: vi.fn(),
  mockResolveOrgDashboardPath: vi.fn(),
  mockResolveOrgLoginPath: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser: mockSessionGetUser,
    },
  })),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: mockGetAccountByAuthUserId,
  getAccountByAuthUserIdInOrg: mockGetAccountByAuthUserIdInOrg,
  getAccountByEmail: mockGetAccountByEmail,
  insertAccountForAuthUser: mockInsertAccountForAuthUser,
  updateAccountAuthUserId: mockUpdateAccountAuthUserId,
  updateAccountStatus: mockUpdateAccountStatus,
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: mockGetUserRoles,
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: mockGetProfileByAccountId,
  insertProfileForAccount: mockInsertProfileForAccount,
}));

vi.mock('@iconicedu/web/lib/onboarding/auth-state', () => ({
  buildAuthOnboardingState: vi.fn(
    (
      account: {
        primary_role?: string | null;
        role_status?: string | null;
        onboarding_completed_at?: string | null;
      },
      roleRows: Array<{ role_key: string }>,
    ) => {
      const hasAnyRole =
        roleRows.length > 0 ||
        account.primary_role === 'guardian' ||
        account.primary_role === 'educator' ||
        account.primary_role === 'child' ||
        account.primary_role === 'staff' ||
        account.primary_role === 'admin' ||
        account.primary_role === 'owner';
      const requiresRoleSelection =
        !hasAnyRole ||
        !account.primary_role ||
        !account.onboarding_completed_at ||
        account.role_status === 'unassigned' ||
        !account.role_status;

      if (requiresRoleSelection) {
        return { requiresRoleSelection: true, destination: null };
      }
      if (account.role_status === 'pending' || account.role_status === 'blocked') {
        return { requiresRoleSelection: false, destination: '/login/pending-access' };
      }
      return { requiresRoleSelection: false, destination: '/dashboard' };
    },
  ),
}));

vi.mock('@iconicedu/web/lib/org/queries/org.query', () => ({
  getOrgBySlug: mockGetOrgBySlug,
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: mockResolveOrgDashboardPath,
}));

vi.mock('@iconicedu/web/lib/org/resolve-auth-path', () => ({
  resolveDefaultOrgLoginPath: vi.fn(),
  resolveOrgLoginPath: mockResolveOrgLoginPath,
}));

describe('POST /api/accounts/activate', () => {
  beforeEach(() => {
    mockSessionGetUser.mockReset();
    mockGetAccountByAuthUserId.mockReset();
    mockGetAccountByAuthUserIdInOrg.mockReset();
    mockGetAccountByEmail.mockReset();
    mockInsertAccountForAuthUser.mockReset();
    mockUpdateAccountAuthUserId.mockReset();
    mockUpdateAccountStatus.mockReset();
    mockGetProfileByAccountId.mockReset();
    mockInsertProfileForAccount.mockReset();
    mockGetUserRoles.mockReset();
    mockGetOrgBySlug.mockReset();
    mockResolveOrgDashboardPath.mockReset();
    mockResolveOrgLoginPath.mockReset();
  });

  it('returns unauthorized without auth user', async () => {
    mockSessionGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(
      new Request(`${APP_URL}/api/accounts/activate`, { method: 'POST' }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns onboarding payload for authenticated users', async () => {
    const now = new Date().toISOString();
    mockGetAccountByAuthUserId.mockResolvedValueOnce({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    mockResolveOrgDashboardPath.mockResolvedValueOnce('/iconic-academy');
    mockSessionGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'iconicedudev+user@gmail.com' } },
    });
    mockUpdateAccountStatus.mockResolvedValueOnce({
      data: {
        id: 'account-1',
        org_id: 'org-1',
        primary_role: 'guardian',
        role_status: 'active',
        onboarding_completed_at: now,
      },
    });
    mockGetUserRoles.mockResolvedValueOnce({
      error: null,
      data: [
        {
          id: 'role-1',
          org_id: 'org-1',
          account_id: 'account-1',
          role_key: 'guardian',
          assigned_at: now,
          created_at: now,
          updated_at: now,
        },
      ],
    });

    const response = await POST(
      new Request(`${APP_URL}/api/accounts/activate`, { method: 'POST' }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('active');
    expect(body.onboarding.destination).toBe('/iconic-academy');
    expect(body.onboarding.requiresRoleSelection).toBe(false);
  });

  it('returns org setup requirement when account is missing', async () => {
    mockSessionGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'iconicedudev+user@gmail.com' } },
    });
    mockGetAccountByAuthUserId.mockResolvedValueOnce({ data: null });

    const response = await POST(
      new Request(`${APP_URL}/api/accounts/activate`, { method: 'POST' }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('needs_org_setup');
    expect(body.onboarding.requiresOrgSetup).toBe(true);
    expect(body.onboarding.destination).toBe('/get-started');
  });

  it('returns org-scoped get-started destination for org login intent', async () => {
    mockSessionGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'iconicedudev+user@gmail.com' } },
    });
    mockGetOrgBySlug.mockResolvedValueOnce({
      data: { id: 'org-9', slug: 'iconic-academy' },
      error: null,
    });
    mockGetAccountByAuthUserIdInOrg.mockResolvedValueOnce({ data: null });

    const response = await POST(
      new Request(`${APP_URL}/api/accounts/activate?org=iconic-academy&intent=login`, {
        method: 'POST',
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('needs_org_setup');
    expect(body.onboarding.destination).toBe('/iconic-academy/get-started');
  });

  it('creates org-scoped account and requires role selection for org get-started', async () => {
    mockSessionGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'iconicedudev+new@gmail.com' } },
    });
    mockGetOrgBySlug.mockResolvedValueOnce({
      data: { id: 'org-1', slug: 'iconic-academy' },
      error: null,
    });
    mockGetAccountByAuthUserIdInOrg.mockResolvedValueOnce({ data: null });
    mockGetAccountByEmail.mockResolvedValueOnce({ data: null, error: null });
    mockInsertAccountForAuthUser.mockResolvedValueOnce({
      data: { id: 'account-new', org_id: 'org-1' },
      error: null,
    });
    mockGetProfileByAccountId.mockResolvedValueOnce({ data: null, error: null });
    mockInsertProfileForAccount.mockResolvedValueOnce({
      data: { id: 'profile-1', org_id: 'org-1', account_id: 'account-new' },
      error: null,
    });
    mockUpdateAccountStatus.mockResolvedValueOnce({
      data: {
        id: 'account-new',
        org_id: 'org-1',
        primary_role: null,
        role_status: 'unassigned',
        onboarding_completed_at: null,
      },
    });
    mockGetUserRoles.mockResolvedValueOnce({
      error: null,
      data: [],
    });

    const response = await POST(
      new Request(
        `${APP_URL}/api/accounts/activate?org=iconic-academy&intent=get-started`,
        {
          method: 'POST',
        },
      ),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('active');
    expect(body.onboarding.requiresRoleSelection).toBe(true);
    expect(body.onboarding.destination).toBe('/iconic-academy/get-started');
    expect(mockInsertAccountForAuthUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: 'org-1',
        authUserId: 'auth-1',
        email: 'iconicedudev+new@gmail.com',
      }),
    );
    expect(mockInsertProfileForAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: 'org-1',
        accountId: 'account-new',
      }),
    );
  });

  it('links invited account with preassigned role and skips role selection', async () => {
    const now = new Date().toISOString();
    mockSessionGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'iconicedudev+invited@gmail.com' } },
    });
    mockGetOrgBySlug.mockResolvedValueOnce({
      data: { id: 'org-1', slug: 'iconic-academy' },
      error: null,
    });
    mockGetAccountByAuthUserIdInOrg.mockResolvedValueOnce({ data: null });
    mockGetAccountByEmail.mockResolvedValueOnce({
      error: null,
      data: {
        id: 'account-invited-1',
        org_id: 'org-1',
        status: 'invited',
      },
    });
    mockUpdateAccountAuthUserId.mockResolvedValueOnce({
      error: null,
      data: {
        id: 'account-invited-1',
        org_id: 'org-1',
        status: 'active',
      },
    });
    mockGetProfileByAccountId.mockResolvedValueOnce({
      data: { id: 'profile-1', account_id: 'account-invited-1' },
      error: null,
    });
    mockUpdateAccountStatus.mockResolvedValueOnce({
      data: {
        id: 'account-invited-1',
        org_id: 'org-1',
        primary_role: 'educator',
        role_status: 'active',
        onboarding_completed_at: now,
      },
    });
    mockGetUserRoles.mockResolvedValueOnce({
      error: null,
      data: [
        {
          id: 'role-1',
          org_id: 'org-1',
          account_id: 'account-invited-1',
          role_key: 'educator',
          assigned_at: now,
          created_at: now,
          updated_at: now,
        },
      ],
    });
    mockResolveOrgDashboardPath.mockResolvedValueOnce('/iconic-academy');

    const response = await POST(
      new Request(
        `${APP_URL}/api/accounts/activate?org=iconic-academy&intent=get-started`,
        {
          method: 'POST',
        },
      ),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('active');
    expect(body.onboarding.requiresRoleSelection).toBe(false);
    expect(body.onboarding.destination).toBe('/iconic-academy');
    expect(mockUpdateAccountAuthUserId).toHaveBeenCalledWith(
      expect.anything(),
      'account-invited-1',
      'auth-1',
    );
  });
});
