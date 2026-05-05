import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/activity-feed/read/route';

const requireEffectiveActorContext = vi.fn();
const createSupabaseServerClient = vi.fn();

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

describe('POST /api/activity-feed/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
    });
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
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== 'activity_feed_items') {
          throw new Error(`Unexpected table ${table}`);
        }
        return { update };
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
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
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
    expect(inUpdate).toHaveBeenCalledWith('id', ['11111111-1111-4111-8111-111111111111']);
  });
});
