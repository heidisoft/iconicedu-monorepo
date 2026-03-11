import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/onboarding/student/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();
const {
  mockGetUser,
  mockGetOrCreateAccount,
  mockGetAccountByAuthUserId,
  mockFrom,
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
  mockFrom: vi.fn(),
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
  createSupabaseServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
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

describe('POST /api/onboarding/student', () => {
  it('returns 400 when invite code is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/onboarding/student`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Invite code is required',
    });
  });

  it('returns 400 when invite code is invalid', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'student@example.com' } },
    });
    mockGetAccountByAuthUserId.mockResolvedValueOnce({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    mockGetOrCreateAccount.mockResolvedValueOnce({
      account: { id: 'account-1', org_id: 'org-1' },
    });

    const maybeSingle = vi.fn().mockResolvedValueOnce({ data: null, error: null });
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
      })),
    }));

    const response = await POST(
      new Request(`${APP_URL}/api/onboarding/student`, {
        method: 'POST',
        body: JSON.stringify({ inviteCode: 'BAD-CODE' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Invalid invite code',
    });
  });

  it('accepts valid invite code and assigns student role', async () => {
    const now = new Date().toISOString();
    const inviteCode = 'JOIN-123';
    const inviteHash = createHash('sha256').update(inviteCode).digest('hex');
    mockResolveOrgDashboardPath.mockResolvedValueOnce('/iconic-academy');
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-1', email: 'student@example.com' } },
    });
    mockGetAccountByAuthUserId.mockResolvedValueOnce({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    mockGetOrCreateAccount.mockResolvedValueOnce({
      account: { id: 'account-1', org_id: 'org-1' },
    });

    const maybeSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'invite-1',
        org_id: 'org-1',
        family_id: null,
        guardian_account_id: null,
        status: 'active',
        expires_at: null,
        max_uses: 1,
        uses: 0,
      },
      error: null,
    });
    const updateCode = vi.fn().mockResolvedValueOnce({ error: null });
    mockFrom
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((field: string, value: string) => {
            if (field === 'code_hash') {
              expect(value).toBe(inviteHash);
            }
            return {
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            };
          }),
        })),
      }))
      .mockImplementationOnce(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => updateCode()),
          })),
        })),
      }));

    mockGetProfileByAccountId.mockResolvedValueOnce({ data: null });
    mockInsertProfileForAccount.mockResolvedValueOnce({ error: null });
    mockSeedSignupDefaultNotificationPreferences.mockResolvedValueOnce({ error: null });
    mockUpsertUserRole.mockResolvedValueOnce({ error: null });
    mockUpdateAccountRoleState.mockResolvedValueOnce({
      error: null,
      data: {
        id: 'account-1',
        org_id: 'org-1',
        primary_role: 'child',
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
          role_key: 'child',
          assigned_at: now,
          created_at: now,
          updated_at: now,
        },
      ],
    });

    const response = await POST(
      new Request(`${APP_URL}/api/onboarding/student`, {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.onboarding.destination).toBe('/iconic-academy');
  });
});
