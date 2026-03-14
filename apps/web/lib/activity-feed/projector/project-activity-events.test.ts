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

function createSupabaseMock() {
  const events = [
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
  const upserts: Array<{ table: string; payload: Record<string, unknown> }> = [];

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
              { profile_id: 'child-profile-1', live_status: 'away' },
              { profile_id: 'guardian-profile-1', live_status: 'away' },
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
                return { data: { id: 'feed-item-1' }, error: null };
              }),
            })),
          })),
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
              { profile_id: 'child-profile-1', live_status: 'away' },
              { profile_id: 'guardian-profile-1', live_status: 'away' },
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
      updates.some(
        (entry) =>
          entry.table === 'activity_feed_items' &&
          entry.payload.occurred_at === '2026-03-08T13:00:00.000Z',
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
                { profile_id: 'profile-1', live_status: 'online' },
                { profile_id: 'profile-2', live_status: 'away' },
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
});
