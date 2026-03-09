import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DELETE,
  GET,
  POST,
} from '@iconicedu/web/app/api/notification-preference-scopes/route';

const requireAuthedUser = vi.fn();
const createSupabaseServerClient = vi.fn();
const getAccountByAuthUserId = vi.fn();
const getProfileByAccountId = vi.fn();

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: (...args: unknown[]) => requireAuthedUser(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: (...args: unknown[]) => getAccountByAuthUserId(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: (...args: unknown[]) => getProfileByAccountId(...args),
}));

function createSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'notification_preference_scopes') {
        throw new Error(`Unexpected table ${table}`);
      }

      const selectChain = {
        eq: vi.fn(() => selectChain),
        is: vi.fn(() => selectChain),
        order: vi.fn(() => selectChain),
        returns: vi.fn(async () => ({
          data: [
            {
              id: 'scope-pref-1',
              org_id: 'org-1',
              profile_id: 'profile-1',
              scope_kind: 'channel',
              scope_id: 'channel-1',
              pref_key: 'message.posted',
              channels: ['push'],
              muted: null,
            },
          ],
          error: null,
        })),
      };

      return {
        select: vi.fn(() => selectChain),
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                id: 'scope-pref-1',
                org_id: 'org-1',
                profile_id: 'profile-1',
                scope_kind: 'channel',
                scope_id: 'channel-1',
                pref_key: 'message.posted',
                channels: ['push'],
                muted: null,
              },
              error: null,
            })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                      returns: vi.fn(async () => ({
                        data: [{ id: 'scope-pref-1' }],
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      };
    }),
  };
}

describe('notification preference scopes route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthedUser.mockResolvedValue({ id: 'auth-user-1' });
    getAccountByAuthUserId.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    getProfileByAccountId.mockResolvedValue({ data: { id: 'profile-1' } });
    createSupabaseServerClient.mockResolvedValue(createSupabaseMock());
  });

  it('GET returns scoped preferences for owner profile', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/notification-preference-scopes?orgId=org-1&profileId=profile-1',
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeKind: 'channel',
          scopeId: 'channel-1',
          prefKey: 'message.posted',
        }),
      ]),
    );
  });

  it('POST upserts scoped preference row', async () => {
    const response = await POST(
      new Request('http://localhost/api/notification-preference-scopes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          profileId: 'profile-1',
          prefKey: 'message.posted',
          scopeKind: 'channel',
          scopeId: 'channel-1',
          channels: ['push'],
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.scopeKind).toBe('channel');
  });

  it('DELETE soft-deletes scoped preference row', async () => {
    const response = await DELETE(
      new Request('http://localhost/api/notification-preference-scopes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          profileId: 'profile-1',
          prefKey: 'message.posted',
          scopeKind: 'channel',
          scopeId: 'channel-1',
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.deletedCount).toBe(1);
  });
});
