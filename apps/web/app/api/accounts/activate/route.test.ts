import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/accounts/activate/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();
const {
  mockSessionGetUser,
  mockServiceFrom,
  mockServiceOrgMaybeSingle,
  mockGetAccountByAuthUserId,
  mockGetOrCreateAccount,
  mockUpdateAccountStatus,
  mockGetUserRoles,
  mockResolveOrgDashboardPath,
} = vi.hoisted(() => ({
  mockSessionGetUser: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockServiceOrgMaybeSingle: vi.fn(),
  mockGetAccountByAuthUserId: vi.fn(),
  mockGetOrCreateAccount: vi.fn(),
  mockUpdateAccountStatus: vi.fn(),
  mockGetUserRoles: vi.fn(),
  mockResolveOrgDashboardPath: vi.fn(),
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
    from: mockServiceFrom,
  })),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: mockGetOrCreateAccount,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: mockGetAccountByAuthUserId,
  updateAccountStatus: mockUpdateAccountStatus,
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: mockGetUserRoles,
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: mockResolveOrgDashboardPath,
}));

describe('POST /api/accounts/activate', () => {
  beforeEach(() => {
    mockSessionGetUser.mockReset();
    mockServiceFrom.mockReset();
    mockServiceOrgMaybeSingle.mockReset();
    mockGetAccountByAuthUserId.mockReset();
    mockGetOrCreateAccount.mockReset();
    mockUpdateAccountStatus.mockReset();
    mockGetUserRoles.mockReset();
    mockResolveOrgDashboardPath.mockReset();
  });

  it('returns unauthorized without auth user', async () => {
    mockSessionGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(new Request(`${APP_URL}/api/accounts/activate`, { method: 'POST' }));
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
      data: { user: { id: 'auth-1', email: 'user@example.com' } },
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
    expect(body.onboarding.destination).toBe('/iconic-academy');
    expect(body.onboarding.requiresRoleSelection).toBe(false);
  });

  it('returns org setup requirement when no org exists yet', async () => {
    mockSessionGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'user@example.com' } },
    });
    mockGetAccountByAuthUserId.mockResolvedValueOnce({ data: null });
    mockServiceFrom.mockImplementationOnce((table: string) => {
      if (table !== 'orgs') {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: mockServiceOrgMaybeSingle,
              })),
            })),
          })),
        })),
      };
    });
    mockServiceOrgMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/accounts/activate`, { method: 'POST' }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('needs_org_setup');
    expect(body.onboarding.requiresOrgSetup).toBe(true);
  });
});
