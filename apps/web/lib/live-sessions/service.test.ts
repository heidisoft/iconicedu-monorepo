import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileRow } from '@iconicedu/shared-types';

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
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
    getJoinAccess: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      joinUrl: `https://meet.example.com/${sessionId}`,
      token: 'join-token',
      metadata: {},
    })),
  })),
}));

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: vi.fn(),
}));

import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { publishActivityEvent } from '@iconicedu/web/lib/activity-feed/publisher/activity-publisher';
import { resolveChannelLiveSessionScope } from '@iconicedu/web/lib/live-sessions/scope';
import {
  createOrJoinLiveSession,
  resolveLiveSessionJoinAccess,
} from '@iconicedu/web/lib/live-sessions/service';

const DEFAULT_ACTOR = {
  authUserId: 'auth-user-1',
  account: {
    id: 'account-1',
    org_id: 'org-1',
  },
  profile: {
    id: 'profile-1',
    account_id: 'account-1',
    kind: 'educator',
    display_name: 'Taylor Reed',
    first_name: 'Taylor',
    last_name: 'Reed',
  } as unknown as ProfileRow,
} as const;

function createServiceSupabaseStub(input?: {
  activeLiveSessionRow?: Record<string, unknown> | null;
  liveSessionConfig?: Record<string, unknown>;
  channel?: Record<string, unknown>;
  existingSessionStartedActivity?: boolean;
  memberProfileIds?: string[];
  familyLinks?: Array<{
    guardianAccountId: string;
    childAccountId: string;
  }>;
  childProfiles?: Array<{
    id: string;
    accountId: string;
    kind?: string;
  }>;
}) {
  let liveSessionRow: Record<string, unknown> | null =
    input?.activeLiveSessionRow ?? null;
  let participantUpserted = false;
  let expectedParticipantsInserted = 0;
  const participantEvents: Array<Record<string, unknown>> = [];
  const memberProfileIds = new Set(input?.memberProfileIds ?? ['profile-1']);
  const familyLinks = input?.familyLinks ?? [];
  const childProfiles = input?.childProfiles ?? [];
  const availableProfiles = [
    { id: 'profile-1', accountId: 'account-1', kind: 'educator' },
    ...childProfiles,
  ];

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
        const filters: { profileIds?: string[] } = {};
        return {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            if (column === 'profile_id') {
              filters.profileIds = [value];
            }
            return this;
          },
          in(column: string, values: string[]) {
            if (column === 'profile_id') {
              filters.profileIds = values;
            }
            return this;
          },
          returns: async () => {
            const scopedIds = filters.profileIds ?? Array.from(memberProfileIds);
            const matches = scopedIds.filter((profileId) =>
              memberProfileIds.has(profileId),
            );
            return {
              data: matches.map((profileId, index) => ({
                id: `member-${index + 1}`,
                profile_id: profileId,
              })),
              error: null,
            };
          },
          is() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => {
            const scopedIds = filters.profileIds ?? Array.from(memberProfileIds);
            const match = scopedIds.some((profileId) => memberProfileIds.has(profileId));
            return { data: match ? { id: 'member-1' } : null, error: null };
          },
        };
      }

      if (table === 'family_links') {
        const filters: { guardianAccountId?: string } = {};
        return {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            if (column === 'guardian_account_id') {
              filters.guardianAccountId = value;
            }
            return this;
          },
          is() {
            return this;
          },
          returns: async () => ({
            data: familyLinks
              .filter((row) => row.guardianAccountId === filters.guardianAccountId)
              .map((row) => ({ child_account_id: row.childAccountId })),
            error: null,
          }),
        };
      }

      if (table === 'profiles') {
        const filters: { accountIds?: string[]; profileIds?: string[]; kind?: string } =
          {};
        return {
          select() {
            return this;
          },
          in(column: string, values: string[]) {
            if (column === 'account_id') {
              filters.accountIds = values;
            }
            if (column === 'id') {
              filters.profileIds = values;
            }
            return this;
          },
          eq(column: string, value: string) {
            if (column === 'kind') {
              filters.kind = value;
            }
            return this;
          },
          is() {
            return this;
          },
          returns: async () => ({
            data: availableProfiles
              .filter(
                (profile) =>
                  !filters.accountIds || filters.accountIds.includes(profile.accountId),
              )
              .filter(
                (profile) =>
                  !filters.profileIds || filters.profileIds.includes(profile.id),
              )
              .filter((profile) => !filters.kind || profile.kind === filters.kind)
              .map((profile) => ({ id: profile.id })),
            error: null,
          }),
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
      serviceSupabase: serviceSupabase as never,
      actor: DEFAULT_ACTOR,
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
      serviceSupabase: serviceSupabase as never,
      actor: DEFAULT_ACTOR,
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
      serviceSupabase: serviceSupabase as never,
      actor: DEFAULT_ACTOR,
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
      serviceSupabase: serviceSupabase as never,
      actor: DEFAULT_ACTOR,
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

  it('allows guardians to join when a linked child is a channel member', async () => {
    vi.mocked(getProfilesByIds).mockResolvedValueOnce({
      data: [
        {
          id: 'profile-guardian-1',
          display_name: 'Riley Guardian',
          avatar_url: null,
          ui_theme_key: null,
        },
      ],
      error: null,
    } as never);

    const serviceSupabase = createServiceSupabaseStub({
      memberProfileIds: ['profile-child-1'],
      familyLinks: [
        { guardianAccountId: 'account-guardian-1', childAccountId: 'account-child-1' },
      ],
      childProfiles: [
        { id: 'profile-child-1', accountId: 'account-child-1', kind: 'child' },
      ],
    });

    const result = await createOrJoinLiveSession({
      serviceSupabase: serviceSupabase as never,
      actor: {
        ...DEFAULT_ACTOR,
        account: {
          id: 'account-guardian-1',
          org_id: 'org-1',
        },
        profile: {
          id: 'profile-guardian-1',
          account_id: 'account-guardian-1',
          kind: 'guardian',
          display_name: 'Riley Guardian',
          first_name: 'Riley',
          last_name: 'Guardian',
        } as unknown as ProfileRow,
      },
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
    });

    expect(result).toMatchObject({
      sessionId: 'live-session-1',
      created: true,
    });
  });

  it('still denies guardians when linked children are not channel members', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      memberProfileIds: ['profile-other-1'],
      familyLinks: [
        { guardianAccountId: 'account-guardian-1', childAccountId: 'account-child-1' },
      ],
      childProfiles: [
        { id: 'profile-child-1', accountId: 'account-child-1', kind: 'child' },
      ],
    });

    await expect(
      createOrJoinLiveSession({
        serviceSupabase: serviceSupabase as never,
        actor: {
          ...DEFAULT_ACTOR,
          account: {
            id: 'account-guardian-1',
            org_id: 'org-1',
          },
          profile: {
            id: 'profile-guardian-1',
            account_id: 'account-guardian-1',
            kind: 'guardian',
            display_name: 'Riley Guardian',
            first_name: 'Riley',
            last_name: 'Guardian',
          } as unknown as ProfileRow,
        },
        channelId: 'channel-1',
        orgSlug: 'iconic-academy',
      }),
    ).rejects.toThrow('Unauthorized');
  });

  it('uses schedule-derived learningSpaceId and scheduleId when channel metadata is missing', async () => {
    vi.mocked(resolveChannelLiveSessionScope).mockResolvedValueOnce({
      scopeKey: 'occurrence:2026-03-02T10:00:00.000Z',
      occurrenceKey: '2026-03-02T10:00:00.000Z',
      occurrenceLabel: 'Mar 2, 10:00 AM',
      occurrenceEndAt: '2026-03-02T11:00:00.000Z',
      isScheduledSessionWindow: true,
      schedule: {
        ids: { id: 'schedule-1', orgId: 'org-1' },
        title: 'Math',
        startAt: '2026-03-02T10:00:00.000Z',
        endAt: '2026-03-02T11:00:00.000Z',
        status: 'scheduled',
        visibility: 'class-members',
        participants: [],
        source: {
          kind: 'class_session',
          learningSpaceId: 'space-derived',
          channelId: 'channel-1',
        },
        audit: {
          createdAt: '2026-03-01T00:00:00.000Z',
          createdBy: 'profile-1',
        },
      },
    });

    const serviceSupabase = createServiceSupabaseStub({
      channel: {
        purpose: 'learning-space',
        primary_entity_id: null,
      },
    });
    const scheduler = createImmediateScheduler();

    await createOrJoinLiveSession({
      serviceSupabase: serviceSupabase as never,
      actor: DEFAULT_ACTOR,
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
      schedulePostJoinSideEffects: scheduler.schedule,
    });

    await scheduler.flush();

    expect(vi.mocked(publishActivityEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.started',
        payload: expect.objectContaining({
          learningSpaceId: 'space-derived',
          scheduleId: 'schedule-1',
          occurrenceStart: '2026-03-02T10:00:00.000Z',
        }),
      }),
    );
    expect(vi.mocked(publishActivityEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'member.joined',
        payload: expect.objectContaining({
          learningSpaceId: 'space-derived',
          scheduleId: 'schedule-1',
          occurrenceStart: '2026-03-02T10:00:00.000Z',
        }),
      }),
    );
    expect(serviceSupabase.state.liveSessionRow?.app_metadata).toMatchObject({
      learningSpaceId: 'space-derived',
      scheduleId: 'schedule-1',
    });
  });

  it('skips publishing session.started when a scheduled learning-space start already exists', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      existingSessionStartedActivity: true,
    });
    const scheduler = createImmediateScheduler();

    await createOrJoinLiveSession({
      serviceSupabase: serviceSupabase as never,
      actor: DEFAULT_ACTOR,
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

  it('returns successfully even when activity publishing fails without logging', async () => {
    const serviceSupabase = createServiceSupabaseStub();
    const scheduler = createImmediateScheduler();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(publishActivityEvent).mockRejectedValueOnce(new Error('activity failed'));

    const result = await createOrJoinLiveSession({
      serviceSupabase: serviceSupabase as never,
      actor: DEFAULT_ACTOR,
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

    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});

describe('resolveLiveSessionJoinAccess', () => {
  it('allows guardians to access a live session when a linked child is a channel member', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      activeLiveSessionRow: {
        id: 'live-session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        status: 'live',
        provider_metadata: {},
      },
      memberProfileIds: ['profile-child-1'],
      familyLinks: [
        { guardianAccountId: 'account-guardian-1', childAccountId: 'account-child-1' },
      ],
      childProfiles: [
        { id: 'profile-child-1', accountId: 'account-child-1', kind: 'child' },
      ],
    });

    const result = await resolveLiveSessionJoinAccess({
      serviceSupabase: serviceSupabase as never,
      liveSessionId: 'live-session-1',
      profile: {
        id: 'profile-guardian-1',
        org_id: 'org-1',
        account_id: 'account-guardian-1',
        kind: 'guardian',
        display_name: 'Riley Guardian',
        first_name: 'Riley',
        last_name: 'Guardian',
      } as never,
    });

    expect(result.session.id).toBe('live-session-1');
    expect(result.joinAccess.joinUrl).toContain('live-session-1');
  });

  it('keeps direct-membership checks for non-guardians', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      activeLiveSessionRow: {
        id: 'live-session-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'daily',
        status: 'live',
        provider_metadata: {},
      },
      memberProfileIds: ['profile-member-1'],
    });

    await expect(
      resolveLiveSessionJoinAccess({
        serviceSupabase: serviceSupabase as never,
        liveSessionId: 'live-session-1',
        profile: {
          id: 'profile-educator-1',
          org_id: 'org-1',
          account_id: 'account-educator-1',
          kind: 'educator',
          display_name: 'Jamie Educator',
          first_name: 'Jamie',
          last_name: 'Educator',
        } as never,
      }),
    ).rejects.toThrow('Unauthorized');
  });
});
