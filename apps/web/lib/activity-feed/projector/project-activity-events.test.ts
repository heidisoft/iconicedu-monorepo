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

function createSupabaseMock(input?: { events?: Array<Record<string, unknown>> }) {
  const events = input?.events ?? [
    {
      id: 'event-1',
      org_id: 'org-1',
      event_type: 'class.created',
      occurred_at: '2026-03-03T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'educator-profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: null,
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        channelId: 'channel-1',
        title: 'Algebra I',
        subject: 'Math',
      },
      audience_rules: [],
      dedupe_key: 'class.created:space-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:00:00.000Z',
      updated_at: '2026-03-03T12:00:00.000Z',
    },
  ];
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
        return {
          select: vi.fn(() => selectChain),
        };
      }

      if (table === 'activity_events') {
        const lookupState: {
          orgId?: string;
          eventType?: string;
          scopeContains?: Record<string, unknown>;
          occurredAtEq?: string;
          occurredAtGte?: string;
          occurredAtLt?: string;
          orderAscending?: boolean;
          limit?: number;
        } = {};

        const lookupChain = {
          eq: vi.fn((column: string, value: unknown) => {
            if (column === 'org_id' && typeof value === 'string') {
              lookupState.orgId = value;
            }
            if (column === 'event_type' && typeof value === 'string') {
              lookupState.eventType = value;
            }
            if (column === 'occurred_at' && typeof value === 'string') {
              lookupState.occurredAtEq = value;
            }
            return lookupChain;
          }),
          contains: vi.fn((column: string, value: Record<string, unknown>) => {
            if (column === 'scope') {
              lookupState.scopeContains = value;
            }
            return lookupChain;
          }),
          gte: vi.fn((column: string, value: string) => {
            if (column === 'occurred_at') {
              lookupState.occurredAtGte = value;
            }
            return lookupChain;
          }),
          lt: vi.fn((column: string, value: string) => {
            if (column === 'occurred_at') {
              lookupState.occurredAtLt = value;
            }
            return lookupChain;
          }),
          is: vi.fn(() => lookupChain),
          order: vi.fn((column: string, options?: { ascending?: boolean }) => {
            if (column === 'occurred_at') {
              lookupState.orderAscending = options?.ascending ?? true;
            }
            return lookupChain;
          }),
          limit: vi.fn((value: number) => {
            lookupState.limit = value;
            return lookupChain;
          }),
          returns: vi.fn(async () => {
            let filtered = events.filter((event) => {
              if (lookupState.orgId && event.org_id !== lookupState.orgId) {
                return false;
              }
              if (lookupState.eventType && event.event_type !== lookupState.eventType) {
                return false;
              }
              if (lookupState.scopeContains) {
                const eventScope = event.scope as Record<string, unknown>;
                for (const [key, value] of Object.entries(lookupState.scopeContains)) {
                  if (eventScope[key] !== value) {
                    return false;
                  }
                }
              }
              if (
                lookupState.occurredAtEq &&
                String(event.occurred_at) !== lookupState.occurredAtEq
              ) {
                return false;
              }
              if (
                lookupState.occurredAtGte &&
                String(event.occurred_at) < lookupState.occurredAtGte
              ) {
                return false;
              }
              if (
                lookupState.occurredAtLt &&
                String(event.occurred_at) >= lookupState.occurredAtLt
              ) {
                return false;
              }
              return true;
            });

            filtered = filtered.sort((a, b) =>
              lookupState.orderAscending === false
                ? String(b.occurred_at).localeCompare(String(a.occurred_at))
                : String(a.occurred_at).localeCompare(String(b.occurred_at)),
            );

            if (typeof lookupState.limit === 'number') {
              filtered = filtered.slice(0, lookupState.limit);
            }

            return { data: filtered, error: null };
          }),
        };

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
            eq: lookupChain.eq,
            contains: lookupChain.contains,
            gte: lookupChain.gte,
            lt: lookupChain.lt,
            order: lookupChain.order,
            limit: lookupChain.limit,
            returns: lookupChain.returns,
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
              },
              {
                id: 'guardian-profile-1',
                account_id: 'guardian-account-1',
                kind: 'guardian',
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
          returns: vi.fn(async () => ({
            data: [
              {
                profile_id: 'child-profile-1',
                live_status: 'away',
                last_seen_at: '2026-03-03T11:04:00.000Z',
              },
              {
                profile_id: 'guardian-profile-1',
                live_status: 'away',
                last_seen_at: '2026-03-03T11:04:00.000Z',
              },
            ],
            error: null,
          })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === 'channel_read_state') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({
            data: [
              { account_id: 'child-account-1', last_read_at: '2026-03-03T11:00:00.000Z' },
              {
                account_id: 'guardian-account-1',
                last_read_at: '2026-03-03T11:00:00.000Z',
              },
            ],
            error: null,
          })),
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
                  return { data: { id: 'feed-item-1' }, error: null };
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

  it('projects class events to participants and guardian recipients', async () => {
    const { supabase, updates, upserts } = createSupabaseMock();

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
    expect(leafUpserts.every((entry) => entry.payload.action_button === null)).toBe(true);
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

  it('creates grouped parent and subactivity rows for hourly class file updates', async () => {
    const { supabase, upserts } = createSupabaseMock();
    const fileEvent = {
      id: 'event-2',
      org_id: 'org-1',
      event_type: 'file.uploaded',
      occurred_at: '2026-03-03T12:30:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'educator-profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-2' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        learningSpaceId: 'space-1',
        learningSpaceTitle: 'Algebra I',
        channelId: 'channel-1',
        name: 'worksheet.pdf',
      },
      audience_rules: [],
      dedupe_key: 'file.uploaded:message-2',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:30:00.000Z',
      updated_at: '2026-03-03T12:30:00.000Z',
    };

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
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
        return {
          select: vi.fn(() => selectChain),
        };
      }

      if (table === 'activity_events') {
        return {
          select: vi.fn(() => ({
            is: vi.fn(() => ({
              lt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    in: vi.fn(() => ({
                      returns: vi.fn(async () => ({ data: [fileEvent], error: null })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(async () => ({ error: null })),
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

      if (table === 'profiles') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({
            data: [
              { id: 'child-profile-1', account_id: 'child-account-1' },
              { id: 'guardian-profile-1', account_id: 'guardian-account-1' },
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
          returns: vi.fn(async () => ({
            data: [
              {
                profile_id: 'child-profile-1',
                live_status: 'away',
                last_seen_at: '2026-03-03T11:04:00.000Z',
              },
              {
                profile_id: 'guardian-profile-1',
                live_status: 'away',
                last_seen_at: '2026-03-03T11:04:00.000Z',
              },
            ],
            error: null,
          })),
        };
        return { select: vi.fn(() => chain) };
      }

      if (table === 'channel_read_state') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({
            data: [
              { account_id: 'child-account-1', last_read_at: '2026-03-03T11:00:00.000Z' },
              {
                account_id: 'guardian-account-1',
                last_read_at: '2026-03-03T11:00:00.000Z',
              },
            ],
            error: null,
          })),
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
          upsert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                upserts.push({ table, payload });
                return {
                  data: { id: payload.kind === 'group' ? 'group-1' : 'leaf-1' },
                  error: null,
                };
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
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
    });

    await projectActivityEvents(supabase as never);

    const feedItemUpserts = upserts.filter(
      (entry) => entry.table === 'activity_feed_items',
    );
    expect(feedItemUpserts.some((entry) => entry.payload.kind === 'group')).toBe(true);
    expect(
      feedItemUpserts.find((entry) => entry.payload.kind === 'group')?.payload,
    ).toMatchObject({
      group_key: 'message-posted:channel-1:2026-03-03T12',
      group_type: 'message',
      content: expect.objectContaining({
        headline: expect.objectContaining({
          primary: 'New class files',
          secondary: 'Algebra I',
        }),
      }),
    });
    expect(
      upserts.find((entry) => entry.table === 'activity_feed_group_members')?.payload,
    ).toMatchObject({
      group_id: 'group-1',
      item_id: 'leaf-1',
    });
  });

  it('updates existing group parent occurred_at when a newer leaf event is projected', async () => {
    getFamilyLinksByOrg.mockResolvedValue({ data: [] });
    getProfilesByAccountIds.mockResolvedValue({ data: [] });

    const events = [
      {
        id: 'event-class-updated-1',
        org_id: 'org-1',
        event_type: 'class.updated',
        occurred_at: '2026-03-08T12:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'educator-profile-1',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        object_ref: null,
        target_ref: { kind: 'learning_space', id: 'space-1' },
        payload: {
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
          title: 'Algebra I',
          activityPhase: 'updated',
        },
        audience_rules: [],
        dedupe_key: 'class.updated:space-1:2026-03-08T12',
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-08T12:00:00.000Z',
        updated_at: '2026-03-08T12:00:00.000Z',
      },
      {
        id: 'event-member-removed-1',
        org_id: 'org-1',
        event_type: 'member.removed',
        occurred_at: '2026-03-08T13:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'educator-profile-1',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        object_ref: null,
        target_ref: { kind: 'learning_space', id: 'space-1' },
        payload: {
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
          title: 'Algebra I',
          activityPhase: 'updated',
          memberCount: 1,
          members: [{ profileId: 'child-profile-1', displayName: 'Child One' }],
        },
        audience_rules: [],
        dedupe_key: 'member.removed:space-1:child-profile-1',
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-08T13:00:00.000Z',
        updated_at: '2026-03-08T13:00:00.000Z',
      },
    ];
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const upserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
    let groupParentLookupCount = 0;

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
          return {
            select: vi.fn(() => selectChain),
          };
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
                      data: [{ profile_id: 'child-profile-1' }],
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === 'activity_feed_items') {
          const selectChain = {
            eq: vi.fn(() => selectChain),
            is: vi.fn(() => selectChain),
            maybeSingle: vi.fn(async () => {
              groupParentLookupCount += 1;
              if (groupParentLookupCount === 1) {
                return { data: null, error: null };
              }
              return { data: { id: 'group-1', verb: 'class.updated' }, error: null };
            }),
          };

          return {
            select: vi.fn(() => selectChain),
            upsert: vi.fn((payload: Record<string, unknown>) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  upserts.push({ table, payload });
                  return {
                    data: {
                      id:
                        payload.kind === 'group'
                          ? 'group-1'
                          : `leaf-${String(payload.source_event_id)}`,
                    },
                    error: null,
                  };
                }),
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

        if (table === 'activity_feed_group_members') {
          return {
            upsert: vi.fn(async (payload: Record<string, unknown>) => {
              upserts.push({ table, payload });
              return { error: null };
            }),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(async () => ({ count: 2, error: null })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await projectActivityEvents(supabase as never);

    expect(
      updates.some((entry) => entry.table === 'activity_feed_items') ||
        upserts.some(
          (entry) =>
            entry.table === 'activity_feed_items' && entry.payload.kind === 'group',
        ),
    ).toBe(true);
  });

  it('suppresses conversational inbox + dispatch for active recipients', async () => {
    getProfilesByIds.mockResolvedValue({
      data: [
        { id: 'profile-1', account_id: 'account-1', kind: 'guardian' },
        { id: 'profile-2', account_id: 'account-2', kind: 'guardian' },
      ],
    });
    getFamilyLinksByOrg.mockResolvedValue({ data: [] });
    getProfilesByAccountIds.mockResolvedValue({ data: [] });

    const event = {
      id: 'event-message-1',
      org_id: 'org-1',
      event_type: 'message.posted',
      occurred_at: '2026-03-12T10:01:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'sender-profile',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: { kind: 'message', id: 'message-1' },
      target_ref: null,
      payload: {
        channelId: 'channel-1',
        senderName: 'Taylor',
        content: 'Hello channel',
      },
      audience_rules: [],
      dedupe_key: 'message.posted:message-1',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-12T10:01:00.000Z',
      updated_at: '2026-03-12T10:01:00.000Z',
    };

    const upserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'activity_events') {
          return {
            select: vi.fn(() => ({
              is: vi.fn(() => ({
                lt: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      in: vi.fn(() => ({
                        returns: vi.fn(async () => ({ data: [event], error: null })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(async () => ({ error: null })),
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
                      data: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }],
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
                { id: 'profile-1', account_id: 'account-1' },
                { id: 'profile-2', account_id: 'account-2' },
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
            returns: vi.fn(async () => ({
              data: [
                {
                  profile_id: 'profile-1',
                  live_status: 'online',
                  last_seen_at: '2026-03-12T10:00:45.000Z',
                },
                {
                  profile_id: 'profile-2',
                  live_status: 'away',
                  last_seen_at: '2026-03-12T09:40:00.000Z',
                },
              ],
              error: null,
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'channel_read_state') {
          const chain = {
            eq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            returns: vi.fn(async () => ({
              data: [
                { account_id: 'account-1', last_read_at: '2026-03-12T10:00:30.000Z' },
                { account_id: 'account-2', last_read_at: '2026-03-12T09:40:00.000Z' },
              ],
              error: null,
            })),
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
            upsert: vi.fn((payload: Record<string, unknown>) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  upserts.push({ table, payload });
                  return { data: { id: 'feed-item-1' }, error: null };
                }),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }

        if (
          table === 'notification_preferences' ||
          table === 'notification_preference_scopes'
        ) {
          const chain = {
            eq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            returns: vi.fn(async () => ({ data: [], error: null })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'activity_feed_group_members') {
          return {
            upsert: vi.fn(async () => ({ error: null })),
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

    await projectActivityEvents(supabase as never);

    expect(enqueueNotificationDispatchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientProfileIds: ['profile-2'],
      }),
    );
    const leafUpserts = upserts.filter((entry) => entry.payload.kind === 'leaf');
    expect(leafUpserts).toHaveLength(1);
    expect(leafUpserts[0]?.payload.recipient_profile_id).toBe('profile-2');
  });

  it('does not suppress non-conversational events', async () => {
    const { supabase, upserts } = createSupabaseMock();
    await projectActivityEvents(supabase as never);

    expect(enqueueNotificationDispatchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientProfileIds: expect.arrayContaining([
          'child-profile-1',
          'guardian-profile-1',
        ]),
      }),
    );
    const leafUpserts = upserts.filter(
      (entry) => entry.table === 'activity_feed_items' && entry.payload.kind === 'leaf',
    );
    expect(leafUpserts).toHaveLength(2);
  });

  it('renders session reminder activity summaries in each recipient timezone', async () => {
    getProfilesByIds.mockResolvedValue({
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
          timezone: 'Asia/Colombo',
        },
      ],
    });

    const reminderEvent = {
      id: 'event-reminder-1',
      org_id: 'org-1',
      event_type: 'session.reminder.sent',
      occurred_at: '2026-03-03T12:34:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-system',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-6' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-6',
        learningSpaceId: 'space-1',
        scheduleId: 'schedule-1',
        title: 'Algebra',
        occurrenceStart: '2026-03-03T12:40:00.000Z',
        reminderOffsetMinutes: 5,
        timezone: 'UTC',
        channelRouteKind: 'space',
      },
      audience_rules: [],
      dedupe_key: 'session.reminder:org-1:schedule-1:2026-03-03T12:40:00.000Z:activity',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T12:34:00.000Z',
      updated_at: '2026-03-03T12:34:00.000Z',
    };

    const upserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (
          table === 'notification_preferences' ||
          table === 'notification_preference_scopes'
        ) {
          const chain = {
            eq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            returns: vi.fn(async () => ({ data: [], error: null })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'activity_events') {
          return {
            select: vi.fn(() => ({
              is: vi.fn(() => ({
                lt: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      in: vi.fn(() => ({
                        returns: vi.fn(async () => ({
                          data: [reminderEvent],
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(async () => ({ error: null })),
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

        if (table === 'profiles') {
          const chain = {
            eq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            returns: vi.fn(async () => ({
              data: [
                { id: 'child-profile-1', account_id: 'child-account-1' },
                { id: 'guardian-profile-1', account_id: 'guardian-account-1' },
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
            returns: vi.fn(async () => ({
              data: [
                {
                  profile_id: 'child-profile-1',
                  live_status: 'away',
                  last_seen_at: '2026-03-03T11:04:00.000Z',
                },
                {
                  profile_id: 'guardian-profile-1',
                  live_status: 'away',
                  last_seen_at: '2026-03-03T11:04:00.000Z',
                },
              ],
              error: null,
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'channel_read_state') {
          const chain = {
            eq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            returns: vi.fn(async () => ({
              data: [
                {
                  account_id: 'child-account-1',
                  last_read_at: '2026-03-03T11:00:00.000Z',
                },
                {
                  account_id: 'guardian-account-1',
                  last_read_at: '2026-03-03T11:00:00.000Z',
                },
              ],
              error: null,
            })),
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
            upsert: vi.fn((payload: Record<string, unknown>) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  upserts.push({ table, payload });
                  return { data: { id: 'feed-item-1' }, error: null };
                }),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }

        if (table === 'activity_feed_group_members') {
          return {
            upsert: vi.fn(async () => ({ error: null })),
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

    await projectActivityEvents(supabase as never);

    const leafUpserts = upserts.filter(
      (entry) => entry.table === 'activity_feed_items' && entry.payload.kind === 'leaf',
    );
    const childItem = leafUpserts.find(
      (entry) => entry.payload.recipient_profile_id === 'child-profile-1',
    );
    const guardianItem = leafUpserts.find(
      (entry) => entry.payload.recipient_profile_id === 'guardian-profile-1',
    );

    expect(childItem?.payload.summary).toBe(
      'Your session for Algebra will start on Mar 3 at 7:40 AM',
    );
    expect(guardianItem?.payload.summary).toBe(
      'Your session for Algebra will start on Mar 3 at 6:10 PM',
    );
  });

  it('injects the recipient role into feedback request activity payload rendering', async () => {
    getProfilesByIds.mockResolvedValue({
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
    });

    const feedbackEvent = {
      id: 'event-feedback-1',
      org_id: 'org-1',
      event_type: 'session.feedback_request.sent',
      occurred_at: '2026-03-03T14:40:00.000Z',
      source_kind: 'system',
      actor_profile_id: 'profile-system',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      object_ref: { kind: 'message', id: 'message-feedback-1' },
      target_ref: { kind: 'learning_space', id: 'space-1' },
      payload: {
        channelId: 'channel-1',
        messageId: 'message-feedback-1',
        learningSpaceId: 'space-1',
        scheduleId: 'schedule-1',
        title: 'Algebra',
        occurrenceStart: '2026-03-03T12:40:00.000Z',
        channelRouteKind: 'space',
        members: [{ profileId: 'child-profile-1', role: 'child', displayName: 'Ava' }],
      },
      audience_rules: [],
      dedupe_key:
        'session.feedback_request:org-1:schedule-1:2026-03-03T12:40:00.000Z:activity',
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-03T14:40:00.000Z',
      updated_at: '2026-03-03T14:40:00.000Z',
    };

    const upserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (
          table === 'notification_preferences' ||
          table === 'notification_preference_scopes'
        ) {
          const chain = {
            eq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            returns: vi.fn(async () => ({ data: [], error: null })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'activity_events') {
          return {
            select: vi.fn(() => ({
              is: vi.fn(() => ({
                lt: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      in: vi.fn(() => ({
                        returns: vi.fn(async () => ({
                          data: [feedbackEvent],
                          error: null,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(async () => ({ error: null })),
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
                        { profile_id: 'guardian-profile-1' },
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
            returns: vi.fn(async () => ({
              data: [
                {
                  profile_id: 'child-profile-1',
                  live_status: 'away',
                  last_seen_at: '2026-03-03T11:04:00.000Z',
                },
                {
                  profile_id: 'guardian-profile-1',
                  live_status: 'away',
                  last_seen_at: '2026-03-03T11:04:00.000Z',
                },
              ],
              error: null,
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'channel_read_state') {
          const chain = {
            eq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            returns: vi.fn(async () => ({
              data: [
                {
                  account_id: 'child-account-1',
                  last_read_at: '2026-03-03T11:00:00.000Z',
                },
                {
                  account_id: 'guardian-account-1',
                  last_read_at: '2026-03-03T11:00:00.000Z',
                },
              ],
              error: null,
            })),
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
            upsert: vi.fn((payload: Record<string, unknown>) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  upserts.push({ table, payload });
                  return {
                    data: { id: `feed-${String(payload.recipient_profile_id)}` },
                    error: null,
                  };
                }),
              })),
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

    await projectActivityEvents(supabase as never);

    const childItem = upserts.find(
      (entry) =>
        entry.table === 'activity_feed_items' &&
        entry.payload.kind === 'leaf' &&
        entry.payload.recipient_profile_id === 'child-profile-1',
    );
    expect(
      (childItem?.payload.content as { headline?: { secondary?: string } }).headline
        ?.secondary,
    ).toBe('How was your Algebra session today?');
    expect(
      (childItem?.payload.metadata as { viewerRole?: string | null }).viewerRole,
    ).toBe('child');
  });

  it('keeps scheduled reminder/start/join/feedback activities in one group with a session.started parent', async () => {
    const { supabase, upserts } = createSupabaseMock({
      events: [
        {
          id: 'event-reminder-scheduled-1',
          org_id: 'org-1',
          event_type: 'session.reminder.sent',
          occurred_at: '2026-03-03T12:34:00.000Z',
          source_kind: 'system',
          actor_profile_id: 'profile-system',
          scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
          object_ref: { kind: 'message', id: 'message-reminder-1' },
          target_ref: { kind: 'learning_space', id: 'space-1' },
          payload: {
            learningSpaceId: 'space-1',
            channelId: 'channel-1',
            scheduleId: 'schedule-1',
            title: 'Algebra',
            occurrenceStart: '2026-03-03T12:40:00.000Z',
            reminderOffsetMinutes: 5,
          },
          audience_rules: [],
          dedupe_key:
            'session.reminder:org-1:space-1:channel-1:2026-03-03T12:40:00.000Z:5:activity',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-03T12:34:00.000Z',
          updated_at: '2026-03-03T12:34:00.000Z',
        },
        {
          id: 'event-start-scheduled-1',
          org_id: 'org-1',
          event_type: 'session.started',
          occurred_at: '2026-03-03T12:40:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'educator-profile-1',
          scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
          object_ref: { kind: 'session', id: 'live-session-1' },
          target_ref: { kind: 'learning_space', id: 'space-1' },
          payload: {
            liveSessionId: 'live-session-1',
            learningSpaceId: 'space-1',
            channelId: 'channel-1',
            scheduleId: 'schedule-1',
            title: 'Algebra',
            occurrenceStart: '2026-03-03T12:40:00.000Z',
            isScheduledSessionWindow: true,
            startedByDisplayName: 'Taylor Reed',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'session.started:live-session-1',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-03T12:40:00.000Z',
          updated_at: '2026-03-03T12:40:00.000Z',
        },
        {
          id: 'event-joined-scheduled-1',
          org_id: 'org-1',
          event_type: 'member.joined',
          occurred_at: '2026-03-03T12:41:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'child-profile-1',
          scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
          object_ref: { kind: 'session', id: 'live-session-1' },
          target_ref: { kind: 'learning_space', id: 'space-1' },
          payload: {
            liveSessionId: 'live-session-1',
            learningSpaceId: 'space-1',
            channelId: 'channel-1',
            scheduleId: 'schedule-1',
            title: 'Algebra',
            occurrenceStart: '2026-03-03T12:40:00.000Z',
            memberProfileId: 'child-profile-1',
            memberDisplayName: 'Taylor Reed',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'member.joined:live-session-1:child-profile-1',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-03T12:41:00.000Z',
          updated_at: '2026-03-03T12:41:00.000Z',
        },
        {
          id: 'event-feedback-scheduled-1',
          org_id: 'org-1',
          event_type: 'session.feedback_request.sent',
          occurred_at: '2026-03-03T13:15:00.000Z',
          source_kind: 'system',
          actor_profile_id: 'profile-system',
          scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
          object_ref: { kind: 'message', id: 'message-feedback-1' },
          target_ref: { kind: 'learning_space', id: 'space-1' },
          payload: {
            learningSpaceId: 'space-1',
            channelId: 'channel-1',
            scheduleId: 'schedule-1',
            title: 'Algebra',
            occurrenceStart: '2026-03-03T12:40:00.000Z',
            messageId: 'message-feedback-1',
          },
          audience_rules: [],
          dedupe_key:
            'session.feedback_request:org-1:space-1:channel-1:2026-03-03T12:40:00.000Z:activity',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-03T13:15:00.000Z',
          updated_at: '2026-03-03T13:15:00.000Z',
        },
      ],
    });

    await projectActivityEvents(supabase as never);

    const expectedGroupKey =
      'live-session:learning_space:space-1:schedule:schedule-1:2026-03-03T12:40';
    const groupUpserts = upserts.filter(
      (entry) => entry.table === 'activity_feed_items' && entry.payload.kind === 'group',
    );
    const uniqueGroupKeys = Array.from(
      new Set(groupUpserts.map((entry) => String(entry.payload.group_key))),
    );

    expect(uniqueGroupKeys).toEqual([expectedGroupKey]);
    expect(
      groupUpserts.some(
        (entry) =>
          entry.payload.group_key === expectedGroupKey &&
          entry.payload.verb === 'session.started',
      ),
    ).toBe(true);
  });

  it('uses recipient and dedupe key for leaf upserts when an activity event has a dedupe key', async () => {
    const { supabase, upserts } = createSupabaseMock({
      events: [
        {
          id: 'event-joined-1',
          org_id: 'org-1',
          event_type: 'member.joined',
          occurred_at: '2026-03-03T12:00:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'child-profile-1',
          scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
          object_ref: { kind: 'session', id: 'session-1' },
          target_ref: { kind: 'learning_space', id: 'space-1' },
          payload: {
            liveSessionId: 'session-1',
            learningSpaceId: 'space-1',
            channelId: 'channel-1',
            title: 'Algebra I',
            occurrenceStart: '2026-03-03T12:00:00.000Z',
            memberProfileId: 'child-profile-1',
            memberDisplayName: 'Taylor Reed',
          },
          audience_rules: [],
          dedupe_key: 'member.joined:session-1:child-profile-1',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-03T12:00:00.000Z',
          updated_at: '2026-03-03T12:00:00.000Z',
        },
      ],
    });

    await projectActivityEvents(supabase as never);

    const leafUpsert = upserts.find(
      (entry) => entry.table === 'activity_feed_items' && entry.payload.kind === 'leaf',
    );
    expect(leafUpsert?.onConflict).toBe('recipient_profile_id,dedupe_key');
  });

  it('marks actor-owned leaf rows as read on projection', async () => {
    const { supabase, upserts } = createSupabaseMock({
      events: [
        {
          id: 'event-actor-joined-1',
          org_id: 'org-1',
          event_type: 'member.joined',
          occurred_at: '2026-03-03T12:00:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'child-profile-1',
          scope: { kind: 'channel', channelId: 'channel-1' },
          object_ref: { kind: 'session', id: 'session-1' },
          target_ref: null,
          payload: {
            liveSessionId: 'session-1',
            channelId: 'channel-1',
            title: 'Algebra I',
            memberProfileId: 'child-profile-1',
            memberDisplayName: 'Taylor Reed',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'member.joined:session-1:child-profile-1',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-03T12:00:00.000Z',
          updated_at: '2026-03-03T12:00:00.000Z',
        },
      ],
    });

    await projectActivityEvents(supabase as never);

    const actorLeaf = upserts.find(
      (entry) =>
        entry.table === 'activity_feed_items' &&
        entry.payload.kind === 'leaf' &&
        entry.payload.recipient_profile_id === 'child-profile-1',
    );

    expect(actorLeaf?.payload.is_read).toBe(true);
    expect(actorLeaf?.payload.read_at).toBe('2026-03-03T12:00:00.000Z');
  });

  it('groups non-learning-space live-session events under the most recent start within one hour', async () => {
    const { supabase, upserts } = createSupabaseMock({
      events: [
        {
          id: 'event-start-1',
          org_id: 'org-1',
          event_type: 'session.started',
          occurred_at: '2026-03-19T12:00:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'profile-1',
          scope: { kind: 'channel', channelId: 'channel-dm-1' },
          object_ref: { kind: 'session', id: 'session-1' },
          target_ref: null,
          payload: {
            liveSessionId: 'session-1',
            channelId: 'channel-dm-1',
            title: 'Direct message',
            channelTopic: 'Direct message',
            startedByDisplayName: 'Tiffany T',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'session.started:session-1',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-19T12:00:00.000Z',
          updated_at: '2026-03-19T12:00:00.000Z',
        },
        {
          id: 'event-start-2',
          org_id: 'org-1',
          event_type: 'session.started',
          occurred_at: '2026-03-19T12:40:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'profile-2',
          scope: { kind: 'channel', channelId: 'channel-dm-1' },
          object_ref: { kind: 'session', id: 'session-2' },
          target_ref: null,
          payload: {
            liveSessionId: 'session-2',
            channelId: 'channel-dm-1',
            title: 'Direct message',
            channelTopic: 'Direct message',
            startedByDisplayName: 'Taylor R',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'session.started:session-2',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-19T12:40:00.000Z',
          updated_at: '2026-03-19T12:40:00.000Z',
        },
        {
          id: 'event-join-1',
          org_id: 'org-1',
          event_type: 'member.joined',
          occurred_at: '2026-03-19T12:50:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'profile-2',
          scope: { kind: 'channel', channelId: 'channel-dm-1' },
          object_ref: { kind: 'session', id: 'session-2' },
          target_ref: null,
          payload: {
            liveSessionId: 'session-2',
            channelId: 'channel-dm-1',
            title: 'Direct message',
            channelTopic: 'Direct message',
            memberProfileId: 'profile-2',
            memberDisplayName: 'Taylor R',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'member.joined:session-2:profile-2',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-19T12:50:00.000Z',
          updated_at: '2026-03-19T12:50:00.000Z',
        },
      ],
    });

    await projectActivityEvents(supabase as never);

    const groupUpserts = upserts.filter(
      (entry) => entry.table === 'activity_feed_items' && entry.payload.kind === 'group',
    );
    const uniqueGroupKeys = Array.from(
      new Set(groupUpserts.map((entry) => String(entry.payload.group_key))),
    );
    expect(uniqueGroupKeys).toEqual([
      'live-session:channel:channel-dm-1:huddle-start:event-start-1',
    ]);

    const sessionStartedLeafUpserts = upserts.filter(
      (entry) =>
        entry.table === 'activity_feed_items' &&
        entry.payload.kind === 'leaf' &&
        entry.payload.verb === 'session.started',
    );
    expect(sessionStartedLeafUpserts).toHaveLength(0);
  });

  it('groups member.joined under session.started when both share the same occurred_at timestamp', async () => {
    const { supabase, upserts } = createSupabaseMock({
      events: [
        {
          id: 'event-join-same-time-1',
          org_id: 'org-1',
          event_type: 'member.joined',
          occurred_at: '2026-03-19T12:00:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'profile-2',
          scope: { kind: 'channel', channelId: 'channel-dm-1' },
          object_ref: { kind: 'session', id: 'session-1' },
          target_ref: null,
          payload: {
            liveSessionId: 'session-1',
            channelId: 'channel-dm-1',
            title: 'Direct message',
            channelTopic: 'Direct message',
            memberProfileId: 'profile-2',
            memberDisplayName: 'Taylor R',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'member.joined:session-1:profile-2',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-19T12:00:00.000Z',
          updated_at: '2026-03-19T12:00:00.000Z',
        },
        {
          id: 'event-start-same-time-1',
          org_id: 'org-1',
          event_type: 'session.started',
          occurred_at: '2026-03-19T12:00:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'profile-1',
          scope: { kind: 'channel', channelId: 'channel-dm-1' },
          object_ref: { kind: 'session', id: 'session-1' },
          target_ref: null,
          payload: {
            liveSessionId: 'session-1',
            channelId: 'channel-dm-1',
            title: 'Direct message',
            channelTopic: 'Direct message',
            startedByDisplayName: 'Tiffany T',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'session.started:session-1',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-19T12:00:00.000Z',
          updated_at: '2026-03-19T12:00:00.000Z',
        },
      ],
    });

    await projectActivityEvents(supabase as never);

    const groupUpserts = upserts.filter(
      (entry) => entry.table === 'activity_feed_items' && entry.payload.kind === 'group',
    );
    const uniqueGroupKeys = Array.from(
      new Set(groupUpserts.map((entry) => String(entry.payload.group_key))),
    );
    expect(uniqueGroupKeys).toEqual([
      'live-session:channel:channel-dm-1:huddle-start:event-start-same-time-1',
    ]);
  });

  it('refreshes session.started parent occurred_at when a newer member.joined is projected', async () => {
    const { supabase, upserts } = createSupabaseMock({
      events: [
        {
          id: 'event-start-refresh-1',
          org_id: 'org-1',
          event_type: 'session.started',
          occurred_at: '2026-03-19T12:00:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'profile-1',
          scope: { kind: 'channel', channelId: 'channel-dm-1' },
          object_ref: { kind: 'session', id: 'session-1' },
          target_ref: null,
          payload: {
            liveSessionId: 'session-1',
            channelId: 'channel-dm-1',
            title: 'Direct message',
            channelTopic: 'Direct message',
            startedByDisplayName: 'Tiffany T',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'session.started:session-1',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-19T12:00:00.000Z',
          updated_at: '2026-03-19T12:00:00.000Z',
        },
        {
          id: 'event-join-refresh-1',
          org_id: 'org-1',
          event_type: 'member.joined',
          occurred_at: '2026-03-19T12:15:00.000Z',
          source_kind: 'profile',
          actor_profile_id: 'profile-2',
          scope: { kind: 'channel', channelId: 'channel-dm-1' },
          object_ref: { kind: 'session', id: 'session-1' },
          target_ref: null,
          payload: {
            liveSessionId: 'session-1',
            channelId: 'channel-dm-1',
            title: 'Direct message',
            channelTopic: 'Direct message',
            memberProfileId: 'profile-2',
            memberDisplayName: 'Taylor R',
            mode: 'video',
          },
          audience_rules: [],
          dedupe_key: 'member.joined:session-1:profile-2',
          projection_status: 'pending',
          projection_attempts: 0,
          created_at: '2026-03-19T12:15:00.000Z',
          updated_at: '2026-03-19T12:15:00.000Z',
        },
      ],
    });

    await projectActivityEvents(supabase as never);

    const latestGroupUpsert = upserts
      .filter(
        (entry) =>
          entry.table === 'activity_feed_items' &&
          entry.payload.kind === 'group' &&
          entry.payload.group_key ===
            'live-session:channel:channel-dm-1:huddle-start:event-start-refresh-1',
      )
      .at(-1);

    const groupTimestampTouch = latestGroupUpsert?.payload;
    expect(groupTimestampTouch).toBeDefined();
    expect(groupTimestampTouch?.occurred_at).toBe('2026-03-19T12:15:00.000Z');
  });
});
