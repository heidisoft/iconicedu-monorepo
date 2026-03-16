import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/admin/activity/events/retry/route';

const requireAuthedUser = vi.fn();
const createSupabaseServerClient = vi.fn();
const createSupabaseServiceClient = vi.fn();
const getAccountByAuthUserIdInOrg = vi.fn();
const getUserRoles = vi.fn();
const projectActivityEvents = vi.fn();

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

vi.mock('@iconicedu/web/lib/activity-feed/projector/project-activity-events', () => ({
  projectActivityEvents: (...args: unknown[]) => projectActivityEvents(...args),
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
    createSupabaseServerClient.mockResolvedValue(createEventLookupSupabase(true));
    createSupabaseServiceClient.mockReturnValue({ from: vi.fn() });
    projectActivityEvents.mockResolvedValue({ processed: 1 });
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
    expect(projectActivityEvents).not.toHaveBeenCalled();
  });

  it('retries the event projection', async () => {
    const serviceClient = { from: vi.fn() };
    createSupabaseServiceClient.mockReturnValueOnce(serviceClient);

    const response = await POST(
      new Request('http://localhost/api/admin/activity/events/retry', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'event-1', orgId: 'org-1' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(projectActivityEvents).toHaveBeenCalledWith(serviceClient, {
      eventIds: ['event-1'],
      limit: 1,
    });
    expect(await response.json()).toEqual({ success: true, processed: 1 });
  });

  it('returns 409 when the retry is not processed', async () => {
    projectActivityEvents.mockResolvedValueOnce({ processed: 0 });

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
