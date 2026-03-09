import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/admin/activity/events/failed/route';

const requireAuthedUser = vi.fn();
const createSupabaseServerClient = vi.fn();
const createSupabaseServiceClient = vi.fn();
const getAccountByAuthUserIdInOrg = vi.fn();
const getUserRoles = vi.fn();

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: (...args: unknown[]) => requireAuthedUser(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: (...args: unknown[]) =>
    createSupabaseServiceClient(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserIdInOrg: (...args: unknown[]) =>
    getAccountByAuthUserIdInOrg(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: (...args: unknown[]) => getUserRoles(...args),
}));

function createServiceSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'activity_events') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(
          (columns: string, options?: { count?: 'exact'; head?: boolean }) => {
            const chain = {
              eq: vi.fn(() => chain),
              is: vi.fn(() => {
                if (options?.head) {
                  return Promise.resolve({ count: 2, error: null });
                }
                return chain;
              }),
              order: vi.fn(() => chain),
              limit: vi.fn(async () => ({
                data: [
                  {
                    id: 'event-1',
                    event_type: 'message.posted',
                    projection_status: 'failed',
                    projection_attempts: 2,
                    last_projection_error: 'render failed',
                  },
                ],
                count: 1,
                error: null,
              })),
            };
            return chain;
          },
        ),
      };
    }),
  };
}

describe('GET /api/admin/activity/events/failed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthedUser.mockResolvedValue({ id: 'auth-user-1' });
    getAccountByAuthUserIdInOrg.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    getUserRoles.mockResolvedValue({
      data: [{ role_key: 'admin' }],
      error: null,
    });
    createSupabaseServerClient.mockResolvedValue({});
    createSupabaseServiceClient.mockReturnValue(createServiceSupabaseMock());
  });

  it('returns projection failure summary and failed events for admins', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/activity/events/failed?orgId=org-1'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      summary: {
        failed: 2,
        pending: 2,
        processing: 2,
      },
      totalFailed: 1,
      events: [
        {
          id: 'event-1',
          event_type: 'message.posted',
          projection_status: 'failed',
          projection_attempts: 2,
          last_projection_error: 'render failed',
        },
      ],
    });
  });

  it('returns 403 for non-admin users', async () => {
    getUserRoles.mockResolvedValueOnce({
      data: [{ role_key: 'guardian' }],
      error: null,
    });

    const response = await GET(
      new Request('http://localhost/api/admin/activity/events/failed?orgId=org-1'),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Forbidden',
    });
  });
});
