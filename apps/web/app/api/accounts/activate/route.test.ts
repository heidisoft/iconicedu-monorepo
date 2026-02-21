import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/accounts/activate/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();
const {
  mockSessionGetUser,
  mockGetOrCreateAccount,
  mockUpdateAccountStatus,
  mockGetUserRoles,
} = vi.hoisted(() => ({
  mockSessionGetUser: vi.fn(),
  mockGetOrCreateAccount: vi.fn(),
  mockUpdateAccountStatus: vi.fn(),
  mockGetUserRoles: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser: mockSessionGetUser,
    },
  })),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: mockGetOrCreateAccount,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  updateAccountStatus: mockUpdateAccountStatus,
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: mockGetUserRoles,
}));

describe('POST /api/accounts/activate', () => {
  it('returns unauthorized without auth user', async () => {
    mockSessionGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(new Request(`${APP_URL}/api/accounts/activate`, { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns onboarding payload for authenticated users', async () => {
    const now = new Date().toISOString();
    mockSessionGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'user@example.com' } },
    });
    mockGetOrCreateAccount.mockResolvedValueOnce({
      account: {
        id: 'account-1',
        org_id: 'org-1',
      },
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

    const response = await POST(new Request(`${APP_URL}/api/accounts/activate`, { method: 'POST' }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('active');
    expect(body.onboarding.destination).toBe('/d');
    expect(body.onboarding.requiresRoleSelection).toBe(false);
  });
});
