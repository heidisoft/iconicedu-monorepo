import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/activity-feed/read/route';

const requireAuthedUser = vi.fn();
const getAccountByAuthUserId = vi.fn();
const getProfileByAccountId = vi.fn();
const createSupabaseServerClient = vi.fn();

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: (...args: unknown[]) => requireAuthedUser(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: (...args: unknown[]) => getAccountByAuthUserId(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: (...args: unknown[]) => getProfileByAccountId(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

describe('POST /api/activity-feed/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthedUser.mockResolvedValue({ id: 'auth-user-1' });
    getAccountByAuthUserId.mockResolvedValue({
      data: { id: 'account-1', org_id: 'org-1' },
    });
    getProfileByAccountId.mockResolvedValue({ data: { id: 'profile-1' } });
  });

  it('marks only the current recipient rows as read', async () => {
    const inUpdate = vi.fn(() => ({
      is: vi.fn(async () => ({ error: null })),
    }));
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: inUpdate,
        })),
      })),
    }));
    const itemsSelectIn = vi.fn(() => ({
      is: vi.fn(async () => ({
        data: [
          { id: '11111111-1111-4111-8111-111111111111', kind: 'leaf' },
          { id: '22222222-2222-4222-8222-222222222222', kind: 'leaf' },
        ],
        error: null,
      })),
    }));
    const itemsSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: itemsSelectIn,
        })),
      })),
    }));
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'activity_feed_items') {
          return {
            select: itemsSelect,
            update,
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        };
      }),
    });

    const response = await POST(
      new Request('http://localhost/api/activity-feed/read', {
        method: 'POST',
        body: JSON.stringify({
          ids: [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222',
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_read: true,
        updated_by: 'profile-1',
      }),
    );
    expect(inUpdate).toHaveBeenCalledWith('id', [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('expands group ids to include member item ids before marking read', async () => {
    const inUpdate = vi.fn(() => ({
      is: vi.fn(async () => ({ error: null })),
    }));
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: inUpdate,
        })),
      })),
    }));
    const itemsSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            is: vi.fn(async () => ({
              data: [{ id: '33333333-3333-4333-8333-333333333333', kind: 'group' }],
              error: null,
            })),
          })),
        })),
      })),
    }));
    const groupMembersSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(async () => ({
          data: [
            { item_id: '44444444-4444-4444-8444-444444444444' },
            { item_id: '55555555-5555-4555-8555-555555555555' },
          ],
          error: null,
        })),
      })),
    }));

    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'activity_feed_items') {
          return {
            select: itemsSelect,
            update,
          };
        }
        if (table === 'activity_feed_group_members') {
          return { select: groupMembersSelect };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      new Request('http://localhost/api/activity-feed/read', {
        method: 'POST',
        body: JSON.stringify({ ids: ['33333333-3333-4333-8333-333333333333'] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(inUpdate).toHaveBeenCalledWith('id', [
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ]);
  });

  it('ignores invalid/non-uuid ids and still updates valid ids', async () => {
    const inUpdate = vi.fn(() => ({
      is: vi.fn(async () => ({ error: null })),
    }));
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: inUpdate,
        })),
      })),
    }));
    const itemsSelectIn = vi.fn(() => ({
      is: vi.fn(async () => ({
        data: [{ id: '11111111-1111-4111-8111-111111111111', kind: 'leaf' }],
        error: null,
      })),
    }));
    const itemsSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: itemsSelectIn,
        })),
      })),
    }));

    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'activity_feed_items') {
          return {
            select: itemsSelect,
            update,
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        };
      }),
    });

    const response = await POST(
      new Request('http://localhost/api/activity-feed/read', {
        method: 'POST',
        body: JSON.stringify({
          ids: [
            '11111111-1111-4111-8111-111111111111',
            'group-1:original-parent',
            'not-a-uuid',
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(itemsSelectIn).toHaveBeenCalledWith('id', [
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(inUpdate).toHaveBeenCalledWith('id', ['11111111-1111-4111-8111-111111111111']);
  });
});
