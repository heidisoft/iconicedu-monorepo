import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const requireAuthedUser = vi.fn();
const createSupabaseServerClient = vi.fn();
const getAccountByAuthUserIdInOrg = vi.fn();
const getUserRoles = vi.fn();

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: (...args: unknown[]) => requireAuthedUser(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserIdInOrg: (...args: unknown[]) =>
    getAccountByAuthUserIdInOrg(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/roles.query', () => ({
  getUserRoles: (...args: unknown[]) => getUserRoles(...args),
}));

function createEventLookupSupabase(eventExists = true) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'activity_events') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                maybeSingle: async () => ({
                  data: eventExists ? { id: 'event-1' } : null,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      };
    }),
  };
}

describe('POST /api/admin/activity/events/retry', () => {
  const originalApiUrl = process.env.API_URL;
  const originalToken = process.env.INTERNAL_ACTIVITY_FEED_TOKEN;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'http://127.0.0.1:54321';
    process.env.INTERNAL_ACTIVITY_FEED_TOKEN = 'secret-token';
    vi.stubGlobal('fetch', fetchMock);
    requireAuthedUser.mockResolvedValue({ id: 'auth-user-1' });
    getAccountByAuthUserIdInOrg.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    getUserRoles.mockResolvedValue({
      data: [{ role_key: 'admin' }],
      error: null,
    });
    createSupabaseServerClient.mockResolvedValue(createEventLookupSupabase(true));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ processed: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    process.env.API_URL = originalApiUrl;
    process.env.INTERNAL_ACTIVITY_FEED_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  it('returns 400 when eventId is missing', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/activity/events/retry', {
        method: 'POST',
        body: JSON.stringify({ orgId: 'org-1' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'eventId is required',
    });
  });

  it('returns 403 when the user is not an admin', async () => {
    getUserRoles.mockResolvedValueOnce({
      data: [{ role_key: 'guardian' }],
      error: null,
    });

    const response = await POST(
      new Request('http://localhost/api/admin/activity/events/retry', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'event-1', orgId: 'org-1' }),
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries the event projection through the API', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/activity/events/retry', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'event-1', orgId: 'org-1' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:54321/internal/activity-feed/project',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
        body: JSON.stringify({
          eventIds: ['event-1'],
          limit: 1,
        }),
      }),
    );
    expect(await response.json()).toEqual({ success: true, processed: 1 });
  });

  it('returns 409 when the retry is not processed', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/admin/activity/events/retry', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'event-1', orgId: 'org-1' }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Event could not be retried. It may have reached the retry limit.',
    });
  });
});
