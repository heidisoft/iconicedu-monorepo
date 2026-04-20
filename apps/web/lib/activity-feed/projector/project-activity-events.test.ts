import { beforeEach, describe, expect, it, vi } from 'vitest';

import { projectActivityEvents } from '@iconicedu/web/lib/activity-feed/projector/project-activity-events';

const enqueueNotificationDispatchJobs = vi.fn();
const getFamilyLinksByOrg = vi.fn();
const getProfilesByIds = vi.fn();
const getProfilesByAccountIds = vi.fn();

vi.mock('@iconicedu/web/lib/family/queries/families.query', () => ({
  getFamilyLinksByOrg: (...args: unknown[]) => getFamilyLinksByOrg(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: (...args: unknown[]) => getProfilesByIds(...args),
  getProfilesByAccountIds: (...args: unknown[]) => getProfilesByAccountIds(...args),
}));

vi.mock('@iconicedu/web/lib/notifications/dispatch-jobs', () => ({
  enqueueNotificationDispatchJobs: (...args: unknown[]) =>
    enqueueNotificationDispatchJobs(...args),
}));

function createSupabaseMock(events: Array<Record<string, unknown>>) {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const upserts: Array<{
    table: string;
    payload: Record<string, unknown>;
    onConflict?: string;
  }> = [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (
        table === 'notification_preferences' ||
        table === 'notification_preference_scopes'
      ) {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          in: vi.fn(() => selectChain),
          is: vi.fn(() => selectChain),
          returns: vi.fn(async () => ({ data: [], error: null })),
        };
        return { select: vi.fn(() => selectChain) };
      }

      if (table === 'activity_events') {
        return {
          select: vi.fn(() => ({
            is: vi.fn(() => ({
              lt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    in: vi.fn(() => ({
                      returns: vi.fn(async () => ({ data: events, error: null })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(() => ({
              is: vi.fn(async () => {
                updates.push({ table, payload });
                return { error: null };
              }),
            })),
          })),
        };
      }

      if (table === 'learning_space_participants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      { profile_id: 'child-profile-1' },
                      { profile_id: 'educator-profile-1' },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'channel_members') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  returns: vi.fn(async () => ({
                    data: [
                      { profile_id: 'child-profile-1' },
                      { profile_id: 'educator-profile-1' },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'profiles') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({
            data: [
              {
                id: 'child-profile-1',
                account_id: 'child-account-1',
                kind: 'child',
                timezone: 'America/New_York',
              },
              {
                id: 'guardian-profile-1',
                account_id: 'guardian-account-1',
                kind: 'guardian',
                timezone: 'America/New_York',
              },
            ],
            error: null,
          })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === 'profile_presence') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({ data: [], error: null })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === 'channel_read_state') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({ data: [], error: null })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === 'activity_feed_items') {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          is: vi.fn(() => selectChain),
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        };

        return {
          select: vi.fn(() => selectChain),
          upsert: vi.fn(
            (payload: Record<string, unknown>, options?: { onConflict?: string }) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  upserts.push({ table, payload, onConflict: options?.onConflict });
                  return {
                    data: { id: payload.kind === 'group' ? 'group-1' : 'leaf-1' },
                    error: null,
                  };
                }),
              })),
            }),
          ),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn(async () => {
              updates.push({ table, payload });
              return { error: null };
            }),
          })),
        };
      }

      if (table === 'activity_feed_group_members') {
        return {
          upsert: vi.fn(async (payload: Record<string, unknown>) => {
            upserts.push({ table, payload });
            return { error: null };
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(async () => ({ count: 1, error: null })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { supabase, updates, upserts };
}

describe('projectActivityEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enqueueNotificationDispatchJobs.mockResolvedValue({ enqueued: 0 });
    getProfilesByIds.mockResolvedValue({
      data: [{ id: 'child-profile-1', account_id: 'child-account-1', kind: 'child' }],
    });
    getFamilyLinksByOrg.mockResolvedValue({
      data: [
        {
          guardian_account_id: 'guardian-account-1',
          child_account_id: 'child-account-1',
        },
      ],
    });
    getProfilesByAccountIds.mockResolvedValue({
      data: [
        { id: 'guardian-profile-1', account_id: 'guardian-account-1', kind: 'guardian' },
      ],
    });
  });

  it('projects class cancellation events to participants and guardians, excluding the actor', async () => {
    const { supabase, upserts, updates } = createSupabaseMock([
      {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'class.session.canceled',
        occurred_at: '2026-03-03T12:00:00.000Z',
        source_kind: 'system',
        actor_profile_id: 'educator-profile-1',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        object_ref: null,
        target_ref: { kind: 'learning_space', id: 'space-1' },
        payload: {
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
          learningSpaceTitle: 'Algebra I',
        },
        audience_rules: [],
        dedupe_key: 'session.canceled:exception-1',
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-03T12:00:00.000Z',
        updated_at: '2026-03-03T12:00:00.000Z',
      },
    ]);

    const result = await projectActivityEvents(supabase as never);

    expect(result).toEqual({ processed: 1 });
    const itemUpserts = upserts.filter((entry) => entry.table === 'activity_feed_items');
    const leafUpserts = itemUpserts.filter((entry) => entry.payload.kind === 'leaf');
    expect(leafUpserts).toHaveLength(2);
    expect(leafUpserts.map((entry) => entry.payload.recipient_profile_id)).toEqual(
      expect.arrayContaining(['child-profile-1', 'guardian-profile-1']),
    );
    expect(leafUpserts.map((entry) => entry.payload.recipient_profile_id)).not.toContain(
      'educator-profile-1',
    );
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'activity_events',
          payload: expect.objectContaining({ projection_status: 'processing' }),
        }),
        expect.objectContaining({
          table: 'activity_events',
          payload: expect.objectContaining({ projection_status: 'projected' }),
        }),
      ]),
    );
  });

  it('creates grouped parent rows for hourly channel messages', async () => {
    const { supabase, upserts } = createSupabaseMock([
      {
        id: 'event-2',
        org_id: 'org-1',
        event_type: 'message.posted',
        occurred_at: '2026-03-03T12:30:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'educator-profile-1',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: { kind: 'message', id: 'message-2' },
        target_ref: null,
        payload: {
          channelId: 'channel-1',
          messageId: 'message-2',
          senderName: 'Educator',
          content: 'Please review the worksheet.',
          channelTopic: 'Algebra I',
        },
        audience_rules: [],
        dedupe_key: 'message.posted:message-2',
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-03T12:30:00.000Z',
        updated_at: '2026-03-03T12:30:00.000Z',
      },
    ]);

    await projectActivityEvents(supabase as never);

    const feedItemUpserts = upserts.filter(
      (entry) => entry.table === 'activity_feed_items',
    );
    const groupUpserts = feedItemUpserts.filter(
      (entry) => entry.payload.kind === 'group',
    );
    const leafUpserts = feedItemUpserts.filter((entry) => entry.payload.kind === 'leaf');

    expect(groupUpserts).toHaveLength(2);
    expect(leafUpserts).toHaveLength(2);
    expect(groupUpserts[0]?.payload).toMatchObject({
      group_key: 'message-posted:channel-1:2026-03-03T12',
      group_type: 'message',
      verb: 'messages.posted',
    });
  });

  it('uses recipient_profile_id,dedupe_key for leaf upserts when a dedupe key is present', async () => {
    const { supabase, upserts } = createSupabaseMock([
      {
        id: 'event-3',
        org_id: 'org-1',
        event_type: 'payment.reminder.sent',
        occurred_at: '2026-03-03T12:00:00.000Z',
        source_kind: 'system',
        actor_profile_id: null,
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        object_ref: null,
        target_ref: null,
        payload: {
          title: 'Invoice overdue',
          summary: 'Please pay by March 10.',
          href: '/billing/invoice-1',
        },
        audience_rules: [],
        dedupe_key: 'payment.reminder.sent:invoice-1',
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-03T12:00:00.000Z',
        updated_at: '2026-03-03T12:00:00.000Z',
      },
    ]);

    await projectActivityEvents(supabase as never);

    const leafUpsert = upserts.find(
      (entry) => entry.table === 'activity_feed_items' && entry.payload.kind === 'leaf',
    );

    expect(leafUpsert?.onConflict).toBe('recipient_profile_id,dedupe_key');
  });
});
