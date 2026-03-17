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
  mockGetProfileByAccountId,
  mockInsertProfileForAccount,
  mockSeedSignupDefaultNotificationPreferences,
  mockSeedDefaultOrgSubjectCatalog,
  mockEnsureSupportChannel,
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
  mockGetProfileByAccountId: vi.fn(),
  mockInsertProfileForAccount: vi.fn(),
  mockSeedSignupDefaultNotificationPreferences: vi.fn(),
  mockSeedDefaultOrgSubjectCatalog: vi.fn(),
  mockEnsureSupportChannel: vi.fn(),
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

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: mockGetProfileByAccountId,
  insertProfileForAccount: mockInsertProfileForAccount,
}));

vi.mock('@iconicedu/web/lib/profile/queries/notification-defaults-seed.query', () => ({
  seedSignupDefaultNotificationPreferences: mockSeedSignupDefaultNotificationPreferences,
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: mockResolveOrgDashboardPath,
}));

vi.mock('@iconicedu/web/lib/subjects/queries/org-subject-catalog.query', () => ({
  seedDefaultOrgSubjectCatalog: (...args: unknown[]) =>
    mockSeedDefaultOrgSubjectCatalog(...args),
}));

vi.mock('@iconicedu/web/lib/channels/actions/ensure-support-channel', () => ({
  ensureSupportChannel: (...args: unknown[]) => mockEnsureSupportChannel(...args),
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
    mockGetProfileByAccountId.mockReset();
    mockInsertProfileForAccount.mockReset();
    mockSeedSignupDefaultNotificationPreferences.mockReset();
    mockSeedDefaultOrgSubjectCatalog.mockReset();
    mockEnsureSupportChannel.mockReset();
    mockSeedDefaultOrgSubjectCatalog.mockResolvedValue({ error: null });
    mockEnsureSupportChannel.mockResolvedValue({ channelId: 'support-1' });
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
    mockGetProfileByAccountId.mockResolvedValueOnce({ data: null, error: null });
    mockInsertProfileForAccount.mockResolvedValueOnce({
      data: { id: 'profile-1' },
      error: null,
    });
    mockSeedSignupDefaultNotificationPreferences.mockResolvedValueOnce({ error: null });
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
        select: vi.fn((_columns: string, _options?: { head?: boolean }) => {
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
    expect(mockEnsureSupportChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        creatorProfileId: 'profile-1',
      }),
    );
  });

  it('allows an authenticated user to create another organization', async () => {
    const now = new Date().toISOString();
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'owner@example.com' } },
    });
    mockResolveOrgDashboardPath.mockResolvedValueOnce('/second-org');
    mockGetOrCreateAccount.mockResolvedValueOnce({
      account: { id: 'account-2', org_id: 'org-2' },
    });
    mockGetProfileByAccountId.mockResolvedValueOnce({ data: null, error: null });
    mockInsertProfileForAccount.mockResolvedValueOnce({
      data: { id: 'profile-2' },
      error: null,
    });
    mockSeedSignupDefaultNotificationPreferences.mockResolvedValueOnce({ error: null });
    mockUpsertUserRole.mockResolvedValueOnce({ error: null });
    mockUpdateAccountRoleState.mockResolvedValueOnce({
      error: null,
      data: {
        id: 'account-2',
        org_id: 'org-2',
        primary_role: 'owner',
        role_status: 'active',
        onboarding_completed_at: now,
      },
    });
    mockGetUserRoles.mockResolvedValueOnce({
      error: null,
      data: [
        {
          id: 'role-2',
          org_id: 'org-2',
          account_id: 'account-2',
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
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: mockOrgSlugMaybeSingle,
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockOrgInsertSingle,
          })),
        })),
      };
    });
    mockOrgSlugMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockOrgInsertSingle.mockResolvedValueOnce({
      data: { id: 'org-2', name: 'Second Org', slug: 'second-org' },
      error: null,
    });

    const response = await POST(
      new Request(`${APP_URL}/api/orgs/bootstrap`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Second Org', slug: 'second-org' }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.org.slug).toBe('second-org');
    expect(body.onboarding.destination).toBe('/second-org');
    expect(mockGetOrCreateAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgId: 'org-2',
        authUserId: 'auth-1',
        authEmail: 'owner@example.com',
      }),
    );
  });
});
