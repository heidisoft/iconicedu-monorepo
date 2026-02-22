import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/orgs/bootstrap/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();
const {
  mockGetUser,
  mockFrom,
  mockGetAccountByAuthUserId,
  mockOrgSlugMaybeSingle,
  mockOrgInsertSingle,
  mockGetOrCreateAccount,
  mockUpsertUserRole,
  mockUpdateAccountRoleState,
  mockGetUserRoles,
  mockResolveOrgDashboardPath,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockGetAccountByAuthUserId: vi.fn(),
  mockOrgSlugMaybeSingle: vi.fn(),
  mockOrgInsertSingle: vi.fn(),
  mockGetOrCreateAccount: vi.fn(),
  mockUpsertUserRole: vi.fn(),
  mockUpdateAccountRoleState: vi.fn(),
  mockGetUserRoles: vi.fn(),
  mockResolveOrgDashboardPath: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: mockGetOrCreateAccount,
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: mockGetAccountByAuthUserId,
  updateAccountRoleState: mockUpdateAccountRoleState,
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: mockGetUserRoles,
  upsertUserRole: mockUpsertUserRole,
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: mockResolveOrgDashboardPath,
}));

describe('POST /api/orgs/bootstrap', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    mockGetAccountByAuthUserId.mockReset();
    mockOrgSlugMaybeSingle.mockReset();
    mockOrgInsertSingle.mockReset();
    mockGetOrCreateAccount.mockReset();
    mockUpsertUserRole.mockReset();
    mockUpdateAccountRoleState.mockReset();
    mockGetUserRoles.mockReset();
    mockResolveOrgDashboardPath.mockReset();
  });

  it('returns 400 for invalid slug', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/orgs/bootstrap`, {
        method: 'POST',
        body: JSON.stringify({ name: 'ICONIC Academy', slug: 'Bad Slug' }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain('Slug must use lowercase');
  });

  it('creates org, account owner role, and returns destination', async () => {
    const now = new Date().toISOString();
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'owner@example.com' } },
    });
    mockGetAccountByAuthUserId.mockResolvedValueOnce({ data: null, error: null });
    mockResolveOrgDashboardPath.mockResolvedValueOnce('/iconic-academy');
    mockGetOrCreateAccount.mockResolvedValueOnce({
      account: { id: 'account-1', org_id: 'org-1' },
    });
    mockUpsertUserRole.mockResolvedValueOnce({ error: null });
    mockUpdateAccountRoleState.mockResolvedValueOnce({
      error: null,
      data: {
        id: 'account-1',
        org_id: 'org-1',
        primary_role: 'owner',
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
          role_key: 'owner',
          assigned_at: now,
          created_at: now,
          updated_at: now,
        },
      ],
    });

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'orgs') {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn((columns: string, options?: { head?: boolean }) => {
          return {
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                maybeSingle: mockOrgSlugMaybeSingle,
              })),
            })),
          };
        }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockOrgInsertSingle,
          })),
        })),
      };
    });
    mockOrgSlugMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockOrgInsertSingle.mockResolvedValueOnce({
      data: { id: 'org-1', name: 'ICONIC Academy', slug: 'iconic-academy' },
      error: null,
    });

    const response = await POST(
      new Request(`${APP_URL}/api/orgs/bootstrap`, {
        method: 'POST',
        body: JSON.stringify({ name: 'ICONIC Academy', slug: 'iconic-academy' }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.org.slug).toBe('iconic-academy');
    expect(body.onboarding.destination).toBe('/iconic-academy');
  });

  it('returns 409 when auth user already has an assigned organization', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'owner@example.com' } },
    });
    mockGetAccountByAuthUserId.mockResolvedValueOnce({
      data: { id: 'account-1', org_id: 'org-1' },
      error: null,
    });

    const response = await POST(
      new Request(`${APP_URL}/api/orgs/bootstrap`, {
        method: 'POST',
        body: JSON.stringify({ name: 'ICONIC Academy', slug: 'iconic-academy' }),
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).message).toContain('already assigned');
  });
});
