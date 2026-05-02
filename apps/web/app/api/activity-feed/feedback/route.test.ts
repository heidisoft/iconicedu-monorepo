import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/activity-feed/feedback/route';

const requireEffectiveActorContext = vi.fn();
const createSupabaseServerClient = vi.fn();

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

describe('POST /api/activity-feed/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
    });
  });

  it('upserts recipient feedback for an owned activity event', async () => {
    const entitlementQuery = {
      eq: vi.fn(() => entitlementQuery),
      is: vi.fn(() => entitlementQuery),
      limit: vi.fn(() => entitlementQuery),
      maybeSingle: vi.fn(async () => ({ data: { id: 'item-1' }, error: null })),
    };
    const channelMemberQuery = {
      eq: vi.fn(() => channelMemberQuery),
      is: vi.fn(() => channelMemberQuery),
      maybeSingle: vi.fn(async () => ({ data: { id: 'membership-1' }, error: null })),
    };
    const upsertQuery = {
      select: vi.fn(() => upsertQuery),
      single: vi.fn(async () => ({
        data: {
          source_event_id: '11111111-1111-4111-8111-111111111111',
          message_id: '22222222-2222-4222-8222-222222222222',
          class_session_id: '33333333-3333-4333-8333-333333333333',
          classroom_id: '44444444-4444-4444-8444-444444444444',
          channel_id: '55555555-5555-4555-8555-555555555555',
          occurrence_start_at: '2026-03-09T16:00:00.000Z',
          rating: 4,
          comment: 'Needs more examples',
          submitted_at: '2026-03-09T16:00:00.000Z',
        },
        error: null,
      })),
    };

    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'activity_feed_items') {
          return { select: vi.fn(() => entitlementQuery) };
        }
        if (table === 'messages') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { channel_id: '55555555-5555-4555-8555-555555555555' },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'channel_members') {
          return { select: vi.fn(() => channelMemberQuery) };
        }
        if (table === 'learning_spaces') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { status: 'active', archived_at: null },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'class_session_feedback') {
          return { upsert: vi.fn(() => upsertQuery) };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      new Request('http://localhost/api/activity-feed/feedback', {
        method: 'POST',
        body: JSON.stringify({
          orgId: 'org-1',
          classSessionId: '33333333-3333-4333-8333-333333333333',
          classroomId: '44444444-4444-4444-8444-444444444444',
          channelId: '55555555-5555-4555-8555-555555555555',
          sourceEventId: '11111111-1111-4111-8111-111111111111',
          messageId: '22222222-2222-4222-8222-222222222222',
          rating: 4,
          comment: 'Needs more examples',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      sourceEventId: '11111111-1111-4111-8111-111111111111',
      classSessionId: '33333333-3333-4333-8333-333333333333',
      rating: 4,
      comment: 'Needs more examples',
    });
  });

  it('accepts ratings below 5 when comment is missing', async () => {
    const entitlementQuery = {
      eq: vi.fn(() => entitlementQuery),
      is: vi.fn(() => entitlementQuery),
      limit: vi.fn(() => entitlementQuery),
      maybeSingle: vi.fn(async () => ({ data: { id: 'item-1' }, error: null })),
    };
    const upsertQuery = {
      select: vi.fn(() => upsertQuery),
      single: vi.fn(async () => ({
        data: {
          source_event_id: '11111111-1111-4111-8111-111111111111',
          message_id: null,
          class_session_id: '33333333-3333-4333-8333-333333333333',
          classroom_id: '44444444-4444-4444-8444-444444444444',
          channel_id: '55555555-5555-4555-8555-555555555555',
          occurrence_start_at: null,
          rating: 3,
          comment: null,
          submitted_at: '2026-03-09T16:00:00.000Z',
        },
        error: null,
      })),
    };
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'activity_feed_items') {
          return { select: vi.fn(() => entitlementQuery) };
        }
        if (table === 'class_session_feedback') {
          return { upsert: vi.fn(() => upsertQuery) };
        }
        if (table === 'learning_spaces') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: { status: 'active', archived_at: null },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      new Request('http://localhost/api/activity-feed/feedback', {
        method: 'POST',
        body: JSON.stringify({
          orgId: 'org-1',
          classSessionId: '33333333-3333-4333-8333-333333333333',
          classroomId: '44444444-4444-4444-8444-444444444444',
          channelId: '55555555-5555-4555-8555-555555555555',
          sourceEventId: '11111111-1111-4111-8111-111111111111',
          rating: 3,
          comment: ' ',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      rating: 3,
      comment: null,
    });
  });
});
