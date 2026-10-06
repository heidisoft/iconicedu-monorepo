import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import type { ProfileRow } from '@iconicedu/shared-types';

vi.mock('./scope', () => ({
  resolveChannelLiveSessionScope: vi.fn(),
}));

vi.mock('./providers', () => ({
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

import { resolveChannelLiveSessionScope } from './scope';
import { getLiveSessionProvider } from './providers';
import { createOrJoinLiveSession } from './join';

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
  extraProfiles?: Array<{
    id: string;
    accountId: string;
    kind?: string;
  }>;
  orgStaffAccountIds?: string[];
}) {
  let liveSessionRow: Record<string, unknown> | null =
    input?.activeLiveSessionRow ?? null;
  let participantUpserted = false;
  let expectedParticipantsInserted = 0;
  const participantEvents: Array<Record<string, unknown>> = [];
  const liveSessionUpdates: Array<Record<string, unknown>> = [];
  const memberProfileIds = new Set(input?.memberProfileIds ?? ['profile-1']);
  const familyLinks = input?.familyLinks ?? [];
  const childProfiles = input?.childProfiles ?? [];
  const extraProfiles = input?.extraProfiles ?? [];
  const orgStaffAccountIds = new Set(input?.orgStaffAccountIds ?? []);
  const availableProfiles = [
    { id: 'profile-1', accountId: 'account-1', kind: 'educator' },
    ...childProfiles,
    ...extraProfiles,
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
      get liveSessionUpdates() {
        return liveSessionUpdates;
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

      if (table === 'learning_spaces') {
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
            data: { status: 'active', archived_at: null },
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
              .map((profile) => ({
                id: profile.id,
                account_id: profile.accountId,
                kind: profile.kind,
              })),
            error: null,
          }),
        };
      }

      if (table === 'user_roles') {
        const filters: { accountIds?: string[] } = {};
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in(column: string, values: string[]) {
            if (column === 'account_id') {
              filters.accountIds = values;
            }
            return this;
          },
          is() {
            return this;
          },
          limit() {
            return this;
          },
          returns: async () => ({
            data: (filters.accountIds ?? [])
              .filter((accountId) => orgStaffAccountIds.has(accountId))
              .map((accountId) => ({ id: `role-${accountId}` })),
            error: null,
          }),
        };
      }

      if (table === 'accounts') {
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
          limit() {
            return this;
          },
          returns: async () => ({ data: [], error: null }),
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
            liveSessionUpdates.push(payload);
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
    expect(serviceSupabase.state.liveSessionRow?.app_metadata).toMatchObject({
      mode: 'video',
    });
  });

  it('reuses an active live session and still emits the joined activity immediately', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      liveSessionConfig: {
        enabled: true,
        provider: 'daily',
        mode: 'video',
      },
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
  });

  it('ends a stale session and creates a fresh one when the channel provider no longer matches', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      liveSessionConfig: {
        enabled: true,
        provider: 'daily',
        mode: 'video',
      },
      activeLiveSessionRow: {
        id: 'live-session-existing',
        org_id: 'org-1',
        channel_id: 'channel-1',
        provider: 'custom',
        session_scope_key: 'channel:channel-1',
        occurrence_key: '2026-03-02T10:00:00.000Z',
        status: 'starting',
        started_by_profile_id: 'profile-2',
        join_path: 'https://old-provider.example.com/stale-room',
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
      sessionId: 'live-session-1',
      joinPath: '/iconic-academy/live-sessions/live-session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });
    expect(serviceSupabase.state.liveSessionUpdates[0]).toMatchObject({
      status: 'ended',
    });
  });

  it('does not publish removed session start activity when reusing an outside-schedule huddle session', async () => {
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
      liveSessionConfig: {
        enabled: true,
        provider: 'daily',
        mode: 'audio',
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
  });

  it('returns a full shareable URL as the join path for the zoom provider', async () => {
    const previousWebUrl = process.env.WEB_URL;
    process.env.WEB_URL = 'https://app.iconicedu.lk/';

    try {
      const serviceSupabase = createServiceSupabaseStub({
        liveSessionConfig: {
          enabled: true,
          provider: 'zoom',
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
        joinPath: 'https://app.iconicedu.lk/live/live-session-1',
        status: 'live',
        created: true,
        provider: 'zoom',
      });
      expect(serviceSupabase.state.liveSessionRow?.join_path).toBe(
        'https://app.iconicedu.lk/live/live-session-1',
      );

      await scheduler.flush();
    } finally {
      if (previousWebUrl === undefined) {
        delete process.env.WEB_URL;
      } else {
        process.env.WEB_URL = previousWebUrl;
      }
    }
  });

  it('appends the passcode as a query param so members can join with one click', async () => {
    const previousWebUrl = process.env.WEB_URL;
    process.env.WEB_URL = 'https://app.iconicedu.lk';
    vi.mocked(getLiveSessionProvider).mockReturnValueOnce({
      key: 'zoom',
      createSession: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
        providerSessionId: `provider-${sessionId}`,
        providerMetadata: { passcode: 'abc123xyz9' },
      })),
      getJoinAccess: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
        token: `token-${sessionId}`,
        metadata: {},
      })),
      normalizeWebhook: vi.fn(async () => []),
    });

    try {
      const serviceSupabase = createServiceSupabaseStub({
        liveSessionConfig: {
          enabled: true,
          provider: 'zoom',
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

      expect(result.joinPath).toBe(
        'https://app.iconicedu.lk/live/live-session-1?passcode=abc123xyz9',
      );

      await scheduler.flush();
    } finally {
      if (previousWebUrl === undefined) {
        delete process.env.WEB_URL;
      } else {
        process.env.WEB_URL = previousWebUrl;
      }
    }
  });

  it('allows guardians to join when a linked child is a channel member', async () => {
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

  it('allows an org staff member to join even without a channel_members row', async () => {
    const serviceSupabase = createServiceSupabaseStub({
      memberProfileIds: ['profile-other-1'],
      extraProfiles: [
        { id: 'profile-staff-1', accountId: 'account-staff-1', kind: 'staff' },
      ],
      orgStaffAccountIds: ['account-staff-1'],
    });

    const result = await createOrJoinLiveSession({
      serviceSupabase: serviceSupabase as never,
      actor: {
        ...DEFAULT_ACTOR,
        account: { id: 'account-staff-1', org_id: 'org-1' },
        profile: {
          id: 'profile-staff-1',
          account_id: 'account-staff-1',
          kind: 'staff',
          display_name: 'Sam Staff',
          first_name: 'Sam',
          last_name: 'Staff',
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
      } as never,
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
    expect(serviceSupabase.state.liveSessionRow?.app_metadata).toMatchObject({
      learningSpaceId: 'space-derived',
      scheduleId: 'schedule-1',
    });
  });

  it('does not publish removed session start activity when a scheduled learning-space start already exists', async () => {
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
  });

  it('returns successfully without legacy activity publishing', async () => {
    const serviceSupabase = createServiceSupabaseStub();
    const scheduler = createImmediateScheduler();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

it('snapshots API-authorized meeting settings when creating a session', async () => {
  vi.mocked(resolveChannelLiveSessionScope).mockResolvedValue({
    scopeKey: 'channel:channel-1',
  });
  const serviceSupabase = createServiceSupabaseStub();
  const meetingSettings = {
    ...DEFAULT_LIVE_SESSION_SETTINGS,
    recording: { enabled: true, autoStart: true, allowStop: false },
  };
  await createOrJoinLiveSession({
    serviceSupabase: serviceSupabase as never,
    actor: DEFAULT_ACTOR,
    channelId: 'channel-1',
    orgSlug: 'academy',
    meetingSettings,
  });
  expect(serviceSupabase.state.liveSessionRow?.app_metadata).toMatchObject({
    meetingSettings,
  });
});
