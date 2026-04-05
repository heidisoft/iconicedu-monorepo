import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/onboarding/role/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();
const {
  mockGetUser,
  mockGetOrCreateAccount,
  mockGetAccountByAuthUserId,
  mockGetProfileByAccountId,
  mockInsertProfileForAccount,
  mockUpdateProfileForAccount,
  mockUpsertUserRole,
  mockUpdateAccountRoleState,
  mockGetUserRoles,
  mockResolveOrgDashboardPath,
  mockSeedSignupDefaultNotificationPreferences,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetOrCreateAccount: vi.fn(),
  mockGetAccountByAuthUserId: vi.fn(),
  mockGetProfileByAccountId: vi.fn(),
  mockInsertProfileForAccount: vi.fn(),
  mockUpdateProfileForAccount: vi.fn(),
  mockUpsertUserRole: vi.fn(),
  mockUpdateAccountRoleState: vi.fn(),
  mockGetUserRoles: vi.fn(),
  mockResolveOrgDashboardPath: vi.fn(),
  mockSeedSignupDefaultNotificationPreferences: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: mockGetOrCreateAccount,
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: mockGetProfileByAccountId,
  insertProfileForAccount: mockInsertProfileForAccount,
  updateProfileForAccount: mockUpdateProfileForAccount,
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: mockGetUserRoles,
  upsertUserRole: mockUpsertUserRole,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: mockGetAccountByAuthUserId,
  updateAccountRoleState: mockUpdateAccountRoleState,
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: mockResolveOrgDashboardPath,
}));

vi.mock('@iconicedu/web/lib/profile/queries/notification-defaults-seed.query', () => ({
  seedSignupDefaultNotificationPreferences: mockSeedSignupDefaultNotificationPreferences,
}));

describe('POST /api/onboarding/role', () => {
  it('returns 400 for invalid role', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/onboarding/role`, {
        method: 'POST',
        body: JSON.stringify({ role: 'invalid' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Valid role is required',
    });
  });

  it('returns 403 when staff validation fails', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'iconicedudev+user@gmail.com' } },
    });
    mockGetAccountByAuthUserId.mockResolvedValueOnce({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    mockGetOrCreateAccount.mockResolvedValueOnce({
      account: { id: 'account-1', org_id: 'org-1' },
    });

    const response = await POST(
      new Request(`${APP_URL}/api/onboarding/role`, {
        method: 'POST',
        body: JSON.stringify({ role: 'staff' }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Staff access is restricted. Contact support if you need access.',
    });
  });

  it('assigns parent role and completes onboarding', async () => {
    const now = new Date().toISOString();
    mockResolveOrgDashboardPath.mockResolvedValueOnce('/iconic-academy');
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'iconicedudev+parent@gmail.com' } },
    });
    mockGetAccountByAuthUserId.mockResolvedValueOnce({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    mockGetOrCreateAccount.mockResolvedValueOnce({
      account: { id: 'account-1', org_id: 'org-1' },
    });
    mockGetProfileByAccountId.mockResolvedValueOnce({ data: null });
    mockInsertProfileForAccount.mockResolvedValueOnce({ error: null });
    mockSeedSignupDefaultNotificationPreferences.mockResolvedValueOnce({ error: null });
    mockUpsertUserRole.mockResolvedValueOnce({ error: null });
    mockUpdateAccountRoleState.mockResolvedValueOnce({
      error: null,
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
      new Request(`${APP_URL}/api/onboarding/role`, {
        method: 'POST',
        body: JSON.stringify({ role: 'parent' }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.onboarding.destination).toBe('/iconic-academy');
    expect(mockUpsertUserRole).toHaveBeenCalled();
    expect(mockUpdateAccountRoleState).toHaveBeenCalled();
  });
});
