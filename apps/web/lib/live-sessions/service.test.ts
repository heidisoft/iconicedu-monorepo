import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(),
  getProfilesByIds: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/live-sessions/scope', () => ({
  resolveChannelLiveSessionScope: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/live-sessions/providers', () => ({
  getLiveSessionProvider: vi.fn(() => ({
    createSession: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      providerSessionId: `provider-${sessionId}`,
      providerMetadata: {},
    })),
  })),
}));

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: vi.fn(),
}));

import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import {
  getProfileByAccountId,
  getProfilesByIds,
} from '@iconicedu/web/lib/profile/queries/profiles.query';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';
import { resolveChannelLiveSessionScope } from '@iconicedu/web/lib/live-sessions/scope';
import { createOrJoinLiveSession } from '@iconicedu/web/lib/live-sessions/service';

function createServiceSupabaseStub(input?: {
  activeLiveSessionRow?: Record<string, unknown> | null;
  liveSessionConfig?: Record<string, unknown>;
  channel?: Record<string, unknown>;
  existingSessionStartedActivity?: boolean;
}) {
  let liveSessionRow: Record<string, unknown> | null =
    input?.activeLiveSessionRow ?? null;
  let participantUpserted = false;
  let expectedParticipantsInserted = 0;
  const participantEvents: Array<Record<string, unknown>> = [];

  return {
    state: {
      get liveSessionRow() {
        return liveSessionRow;
      },
      get participantUpserted() {
        return participantUpserted;
      },
      get expectedParticipantsInserted() {
        return expectedParticipantsInserted;
      },
      get participantEvents() {
        return participantEvents;
      },
    },
    from(table: string) {
      if (table === 'channels') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          maybeSingle: async () => ({
            data: {
              id: 'channel-1',
              org_id: 'org-1',
              kind: 'channel',
              topic: 'Math',
              purpose: 'learning-space',
              primary_entity_id: 'space-1',
              live_session_config: input?.liveSessionConfig ?? {
                enabled: true,
                provider: 'custom',
                mode: 'video',
                joinUrl: 'https://meet.example.com/custom-room',
              },
              ...(input?.channel ?? {}),
            },
            error: null,
          }),
        };
      }

      if (table === 'channel_members') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          returns: async () => ({
            data: [{ profile_id: 'profile-1' }],
            error: null,
          }),
          is() {
            return this;
          },
          maybeSingle: async () => ({ data: { id: 'member-1' }, error: null }),
        };
      }

      if (table === 'channel_live_sessions') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          is() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({ data: liveSessionRow, error: null }),
          insert(payload: Record<string, unknown>) {
            liveSessionRow = {
              id: 'live-session-1',
              org_id: payload.org_id,
              channel_id: payload.channel_id,
              provider: payload.provider,
              provider_session_id: null,
              session_scope_key: payload.session_scope_key,
              occurrence_key: payload.occurrence_key,
              status: payload.status,
              started_by_profile_id: payload.started_by_profile_id,
              started_message_id: null,
              join_path: payload.join_path,
              attendance_policy: payload.attendance_policy,
              started_at: payload.started_at,
              provider_metadata: {},
              app_metadata: payload.app_metadata ?? {},
            };
            return {
              select() {
                return this;
              },
              single: async () => ({ data: liveSessionRow, error: null }),
            };
          },
          update(payload: Record<string, unknown>) {
            liveSessionRow = {
              ...(liveSessionRow ?? {}),
              ...payload,
            };
            return {
              eq() {
                return this;
              },
              select() {
                return this;
              },
              single: async () => ({ data: liveSessionRow, error: null }),
            };
          },
        };
      }

      if (table === 'activity_events') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          contains() {
            return this;
          },
          is() {
            return this;
          },
          limit() {
            return this;
          },
          returns: async () => ({
            data: input?.existingSessionStartedActivity
              ? [{ id: 'event-session-started-existing' }]
              : [],
            error: null,
          }),
        };
      }

      if (table === 'channel_live_session_participants') {
        return {
          upsert() {
            participantUpserted = true;
            return {
              select() {
                return this;
              },
              maybeSingle: async () => ({ data: { id: 'participant-1' }, error: null }),
            };
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          returns: async () => ({ data: [], error: null }),
        };
      }

      if (table === 'channel_live_session_expected_participants') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          is() {
            return this;
          },
          returns: async () => ({ data: [], error: null }),
          insert: async (payload: Array<Record<string, unknown>>) => {
            expectedParticipantsInserted = payload.length;
            return { error: null };
          },
        };
      }

      if (table === 'channel_live_session_participant_events') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            participantEvents.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unhandled table stub: ${table}`);
    },
  };
}

function createImmediateScheduler() {
  const tasks: Promise<void>[] = [];
  return {
    schedule(task: () => Promise<void>) {
      tasks.push(task());
    },
    async flush() {
      await Promise.allSettled(tasks);
    },
  };
}

describe('createOrJoinLiveSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccountByAuthUserId).mockResolvedValue({
      data: {
        id: 'account-1',
        org_id: 'org-1',
      },
      error: null,
    } as never);

    vi.mocked(getProfileByAccountId).mockResolvedValue({
      data: {
        id: 'profile-1',
        display_name: 'Taylor Reed',
        first_name: 'Taylor',
        last_name: 'Reed',
      },
      error: null,
    } as never);

    vi.mocked(getProfilesByIds).mockResolvedValue({
      data: [
        {
          id: 'profile-1',
          display_name: 'Taylor Reed',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    } as never);

    vi.mocked(resolveChannelLiveSessionScope).mockResolvedValue({
      scopeKey: 'channel:channel-1',
      occurrenceKey: '2026-03-02T10:00:00.000Z',
      occurrenceLabel: 'Mar 2, 10:00 AM',
      occurrenceEndAt: '2026-03-02T11:00:00.000Z',
      isScheduledSessionWindow: true,
    });
  });

  it('creates a live session for custom external providers without sending a channel message', async () => {
    const serviceSupabase = createServiceSupabaseStub();
    const scheduler = createImmediateScheduler();

    const result = await createOrJoinLiveSession({
      supabase: {} as never,
      serviceSupabase: serviceSupabase as never,
      authUserId: 'auth-user-1',
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
      schedulePostJoinSideEffects: scheduler.schedule,
    });
    await scheduler.flush();

    expect(result).toEqual({
      sessionId: 'live-session-1',
      joinPath: 'https://meet.example.com/custom-room',
      status: 'live',
      created: true,
      provider: 'custom',
    });

    expect(serviceSupabase.state.liveSessionRow).toMatchObject({
      id: 'live-session-1',
      provider: 'custom',
      status: 'live',
      join_path: 'https://meet.example.com/custom-room',
      started_message_id: null,
    });
    expect(serviceSupabase.state.participantUpserted).toBe(true);
    expect(serviceSupabase.state.expectedParticipantsInserted).toBe(1);
    expect(serviceSupabase.state.participantEvents).toHaveLength(2);
    expect(
      serviceSupabase.state.participantEvents.map((event) => event.event_type),
    ).toEqual(['session_started', 'join_requested']);
    expect(serviceSupabase.state.liveSessionRow?.attendance_policy).toEqual({
      fullAttendanceThresholdPercent: 90,
      graceSeconds: 0,
      countLateJoinAsAttended: true,
      countRejoins: true,
      source: 'hybrid',
    });
    expect(vi.mocked(publishActivityEvent).mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            eventType: 'session.started',
            scope: { kind: 'channel', channelId: 'channel-1' },
            payload: expect.objectContaining({
              title: 'Math',
              occurrenceStart: '2026-03-02T10:00:00.000Z',
              startedByDisplayName: 'Taylor Reed',
              mode: 'video',
              participants: [
                expect.objectContaining({
                  profileId: 'profile-1',
                  displayName: 'Taylor Reed',
                }),
              ],
            }),
          }),
        ],
        [
          expect.objectContaining({
            eventType: 'member.joined',
            dedupeKey: expect.stringContaining('member.joined:live-session-1:profile-1:'),
            scope: { kind: 'channel', channelId: 'channel-1' },
            payload: expect.objectContaining({
              title: 'Math',
              occurrenceStart: '2026-03-02T10:00:00.000Z',
              memberDisplayName: 'Taylor Reed',
              mode: 'video',
              joinedAt: expect.any(String),
            }),
          }),
        ],
      ]),
    );
    expect(serviceSupabase.state.liveSessionRow?.app_metadata).toMatchObject({
      mode: 'video',
    });
  });

  it('reuses an active live session and still emits the joined activity immediately', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      activeLiveSessionRow: {
        id: 'live-session-existing',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        session_scope_key: 'channel:channel-1',
        occurrence_key: '2026-03-02T10:00:00.000Z',
        status: 'live',
        started_by_profile_id: 'profile-2',
        join_path: '/iconic-academy/live-sessions/live-session-existing',
        started_at: '2026-03-02T10:00:00.000Z',
        app_metadata: {
          learningSpaceId: 'space-1',
          occurrenceLabel: 'Mar 2, 10:00 AM',
          scheduleTitle: 'Math',
          mode: 'video',
        },
      },
    });
    const scheduler = createImmediateScheduler();

    const result = await createOrJoinLiveSession({
      supabase: {} as never,
      serviceSupabase: serviceSupabase as never,
      authUserId: 'auth-user-1',
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
      schedulePostJoinSideEffects: scheduler.schedule,
    });
    await scheduler.flush();

    expect(result).toEqual({
      sessionId: 'live-session-existing',
      joinPath: '/iconic-academy/live-sessions/live-session-existing',
      status: 'live',
      created: false,
      provider: 'daily',
    });
    expect(vi.mocked(publishActivityEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'member.joined',
        dedupeKey: expect.stringContaining(
          'member.joined:live-session-existing:profile-1:',
        ),
        scope: { kind: 'channel', channelId: 'channel-1' },
        payload: expect.objectContaining({
          liveSessionId: 'live-session-existing',
          memberDisplayName: 'Taylor Reed',
          mode: 'video',
        }),
      }),
    );
  });

  it('publishes session.started before member.joined when reusing an outside-schedule huddle session', async () => {
    vi.mocked(resolveChannelLiveSessionScope).mockResolvedValueOnce({
      scopeKey: 'channel:channel-1',
      occurrenceKey: null,
      occurrenceLabel: null,
      occurrenceEndAt: null,
      isScheduledSessionWindow: false,
    });

    const serviceSupabase = createServiceSupabaseStub({
      channel: {
        purpose: 'general',
        primary_entity_id: null,
      },
      activeLiveSessionRow: {
        id: 'live-session-huddle-existing',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        session_scope_key: 'channel:channel-1',
        occurrence_key: null,
        status: 'live',
        started_by_profile_id: 'profile-2',
        join_path: '/iconic-academy/live-sessions/live-session-huddle-existing',
        started_at: '2026-03-02T10:00:00.000Z',
        app_metadata: {
          channelTopic: 'General',
          mode: 'audio',
        },
      },
    });
    const scheduler = createImmediateScheduler();

    await createOrJoinLiveSession({
      supabase: {} as never,
      serviceSupabase: serviceSupabase as never,
      authUserId: 'auth-user-1',
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
      schedulePostJoinSideEffects: scheduler.schedule,
    });
    await scheduler.flush();

    const eventTypes = vi
      .mocked(publishActivityEvent)
      .mock.calls.map(([call]) => call.eventType);

    expect(eventTypes).toEqual(
      expect.arrayContaining(['session.started', 'member.joined']),
    );
    expect(eventTypes.indexOf('session.started')).toBeLessThan(
      eventTypes.indexOf('member.joined'),
    );
  });

  it('returns the integrated join path immediately and still queues activity side effects', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      liveSessionConfig: {
        enabled: true,
        provider: 'daily',
        mode: 'video',
      },
    });
    const scheduler = createImmediateScheduler();

    const result = await createOrJoinLiveSession({
      supabase: {} as never,
      serviceSupabase: serviceSupabase as never,
      authUserId: 'auth-user-1',
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
      schedulePostJoinSideEffects: scheduler.schedule,
    });

    expect(result).toEqual({
      sessionId: 'live-session-1',
      joinPath: '/iconic-academy/live-sessions/live-session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });

    await scheduler.flush();

    expect(
      vi.mocked(publishActivityEvent).mock.calls.map(([call]) => call.eventType),
    ).toEqual(expect.arrayContaining(['session.started', 'member.joined']));
  });

  it('skips publishing session.started when a scheduled learning-space start already exists', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      existingSessionStartedActivity: true,
    });
    const scheduler = createImmediateScheduler();

    await createOrJoinLiveSession({
      supabase: {} as never,
      serviceSupabase: serviceSupabase as never,
      authUserId: 'auth-user-1',
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
      schedulePostJoinSideEffects: scheduler.schedule,
    });

    await scheduler.flush();

    const eventTypes = vi
      .mocked(publishActivityEvent)
      .mock.calls.map(([call]) => call.eventType);
    expect(eventTypes).not.toContain('session.started');
    expect(eventTypes).toContain('member.joined');
  });

  it('returns successfully even when activity publishing fails', async () => {
    const serviceSupabase = createServiceSupabaseStub();
    const scheduler = createImmediateScheduler();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(publishActivityEvent).mockRejectedValueOnce(new Error('activity failed'));

    const result = await createOrJoinLiveSession({
      supabase: {} as never,
      serviceSupabase: serviceSupabase as never,
      authUserId: 'auth-user-1',
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
      schedulePostJoinSideEffects: scheduler.schedule,
    });

    expect(result).toEqual({
      sessionId: 'live-session-1',
      joinPath: 'https://meet.example.com/custom-room',
      status: 'live',
      created: true,
      provider: 'custom',
    });

    await scheduler.flush();

    expect(errorSpy).toHaveBeenCalledWith(
      '[live-sessions] post-join side effects failed',
      expect.objectContaining({
        channelId: 'channel-1',
        sessionId: 'live-session-1',
        profileId: 'profile-1',
        error: 'activity failed',
      }),
    );

    errorSpy.mockRestore();
  });
});
