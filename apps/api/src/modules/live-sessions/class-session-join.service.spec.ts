import type { ProfileRow } from '@iconicedu/shared-types';

jest.mock('@iconicedu/api/lib/live-sessions/scope', () => ({
  resolveChannelLiveSessionScope: jest.fn(),
  resolveClassSessionOccurrenceScope: jest.fn(),
  buildOccurrenceScopeKey: (occurrenceKey: string) => `occurrence:${occurrenceKey}`,
}));

jest.mock('@iconicedu/api/lib/live-sessions/providers', () => ({
  getLiveSessionProvider: jest.fn(() => ({
    createSession: jest.fn(async ({ sessionId }: { sessionId: string }) => ({
      providerSessionId: `provider-${sessionId}`,
      providerMetadata: {},
    })),
    getJoinAccess: jest.fn(async () => ({ joinUrl: null, token: null, metadata: {} })),
  })),
}));

jest.mock('@iconicedu/api/lib/live-sessions/expected-participants', () => ({
  snapshotExpectedParticipantsForLiveSession: jest.fn(async () => undefined),
  getLiveSessionAttendancePolicy: jest.fn(() => ({
    fullAttendanceThresholdPercent: 80,
    countLateJoinAsAttended: true,
    countRejoins: true,
    source: 'hybrid',
  })),
}));

import { resolveClassSessionOccurrenceScope } from '@iconicedu/api/lib/live-sessions/scope';
import {
  ClassSessionJoinDeniedError,
  joinClassSessionOccurrence,
  resolveClassSessionJoinAvailability,
} from '@iconicedu/api/modules/live-sessions/live-sessions.service';

const ORG_ID = 'org-1';
const CHANNEL_ID = 'channel-1';
const SCHEDULE_ID = 'schedule-1';
const OCCURRENCE_KEY = '2026-04-10T10:00:00.000Z';
const NOW = new Date('2026-04-01T09:00:00.000Z');

function buildProfile(overrides?: Partial<ProfileRow>): ProfileRow {
  return {
    id: 'profile-1',
    org_id: ORG_ID,
    account_id: 'account-1',
    kind: 'child',
    display_name: 'Sam Rivers',
    first_name: 'Sam',
    last_name: 'Rivers',
    ...overrides,
  } as unknown as ProfileRow;
}

function mockOccurrence(overrides?: {
  isCancelled?: boolean;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  learningSpaceId?: string | null;
  found?: boolean;
}) {
  if (overrides?.found === false) {
    jest.mocked(resolveClassSessionOccurrenceScope).mockResolvedValue(null);
    return;
  }

  const effectiveStartAt = overrides?.effectiveStartAt ?? OCCURRENCE_KEY;
  const effectiveEndAt = overrides?.effectiveEndAt ?? '2026-04-10T11:00:00.000Z';

  jest.mocked(resolveClassSessionOccurrenceScope).mockResolvedValue({
    scope: {
      scopeKey: `occurrence:${OCCURRENCE_KEY}`,
      occurrenceKey: OCCURRENCE_KEY,
      occurrenceEndAt: effectiveEndAt,
      occurrenceLabel: 'Algebra · Apr 10, 10:00 AM',
      schedule: { title: 'Algebra' } as never,
      isScheduledSessionWindow: true,
    },
    schedule: { title: 'Algebra' } as never,
    channelId: CHANNEL_ID,
    learningSpaceId:
      overrides?.learningSpaceId === undefined ? 'space-1' : overrides.learningSpaceId,
    occurrenceKey: OCCURRENCE_KEY,
    effectiveStartAt,
    effectiveEndAt,
    isCancelled: overrides?.isCancelled ?? false,
    compatibleScopeKeys: [`occurrence:${OCCURRENCE_KEY}`],
  });
}

/**
 * Minimal Supabase stub covering only the tables the occurrence join path reads.
 * Each table answers from the sets the test declares, so a test can express
 * "member of the channel", "named on the schedule", or neither.
 */
function createSupabaseStub(input?: {
  memberProfileIds?: string[];
  scheduleParticipantProfileIds?: string[];
  familyLinks?: Array<{ guardianAccountId: string; childAccountId: string }>;
  childProfiles?: Array<{ id: string; accountId: string }>;
  archived?: boolean;
  liveSessionConfig?: Record<string, unknown> | null;
  activeLiveSessionRow?: Record<string, unknown> | null;
}) {
  const memberProfileIds = new Set(input?.memberProfileIds ?? []);
  const scheduleParticipantProfileIds = new Set(
    input?.scheduleParticipantProfileIds ?? [],
  );
  const familyLinks = input?.familyLinks ?? [];
  const childProfiles = input?.childProfiles ?? [];
  let liveSessionRow = input?.activeLiveSessionRow ?? null;
  const inserted: Array<Record<string, unknown>> = [];

  const matchingBuilder = (matches: (column: string, values: string[]) => boolean) => {
    let matched = false;
    const builder = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      limit: () => builder,
      in(column: string, values: string[]) {
        matched = matches(column, values);
        return builder;
      },
      returns: async () => ({
        data: matched ? [{ id: 'row-1' }] : [],
        error: null,
      }),
    };
    return builder;
  };

  return {
    state: {
      get inserted() {
        return inserted;
      },
      get liveSessionRow() {
        return liveSessionRow;
      },
    },
    from(table: string) {
      if (table === 'channel_members') {
        return matchingBuilder(
          (column, values) =>
            column === 'profile_id' && values.some((id) => memberProfileIds.has(id)),
        );
      }

      if (table === 'class_schedule_participants') {
        return matchingBuilder(
          (column, values) =>
            column === 'profile_id' &&
            values.some((id) => scheduleParticipantProfileIds.has(id)),
        );
      }

      if (table === 'family_links') {
        const filters: { guardianAccountId?: string } = {};
        const builder = {
          select: () => builder,
          eq(column: string, value: string) {
            if (column === 'guardian_account_id') filters.guardianAccountId = value;
            return builder;
          },
          is: () => builder,
          returns: async () => ({
            data: familyLinks
              .filter((row) => row.guardianAccountId === filters.guardianAccountId)
              .map((row) => ({ child_account_id: row.childAccountId })),
            error: null,
          }),
        };
        return builder;
      }

      if (table === 'profiles') {
        const filters: { accountIds?: string[] } = {};
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          in(column: string, values: string[]) {
            if (column === 'account_id') filters.accountIds = values;
            return builder;
          },
          returns: async () => ({
            data: childProfiles
              .filter(
                (profile) =>
                  !filters.accountIds || filters.accountIds.includes(profile.accountId),
              )
              .map((profile) => ({ id: profile.id })),
            error: null,
          }),
        };
        return builder;
      }

      if (table === 'learning_spaces') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => ({
            data: input?.archived
              ? { status: 'archived', archived_at: '2026-01-01T00:00:00.000Z' }
              : { status: 'active', archived_at: null },
            error: null,
          }),
        };
        return builder;
      }

      if (table === 'channels') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => ({
            data: {
              id: CHANNEL_ID,
              org_id: ORG_ID,
              kind: 'channel',
              topic: 'Algebra',
              purpose: 'learning-space',
              primary_entity_id: 'space-1',
              live_session_config:
                input?.liveSessionConfig === undefined
                  ? { enabled: true, provider: 'daily', mode: 'video' }
                  : input.liveSessionConfig,
            },
            error: null,
          }),
        };
        return builder;
      }

      if (table === 'channel_live_sessions') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          is: () => builder,
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => ({ data: liveSessionRow, error: null }),
          insert(payload: Record<string, unknown>) {
            inserted.push(payload);
            liveSessionRow = {
              id: 'live-session-1',
              org_id: payload.org_id,
              channel_id: payload.channel_id,
              provider: payload.provider,
              session_scope_key: payload.session_scope_key,
              occurrence_key: payload.occurrence_key,
              status: payload.status,
              join_path: payload.join_path,
              app_metadata: payload.app_metadata,
            };
            return {
              select: () => ({
                single: async () => ({ data: liveSessionRow, error: null }),
              }),
            };
          },
          update(payload: Record<string, unknown>) {
            liveSessionRow = { ...(liveSessionRow ?? {}), ...payload };
            const updateBuilder = {
              eq: () => updateBuilder,
              select: () => ({
                single: async () => ({ data: liveSessionRow, error: null }),
              }),
              then: (resolve: (value: unknown) => unknown) =>
                resolve({ data: liveSessionRow, error: null }),
            };
            return updateBuilder;
          },
        };
        return builder;
      }

      if (table === 'channel_live_session_participants') {
        const builder = {
          upsert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: 'p-1' }, error: null }),
            }),
          }),
        };
        return builder;
      }

      if (table === 'channel_live_session_participant_events') {
        return { insert: async () => ({ error: null }) };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function availabilityFor(input: {
  profile: ProfileRow;
  supabase: ReturnType<typeof createSupabaseStub>;
  anyVisibleJoinEnabled?: boolean;
  now?: Date;
}) {
  return resolveClassSessionJoinAvailability({
    serviceSupabase: input.supabase as never,
    orgId: ORG_ID,
    profile: input.profile,
    scheduleId: SCHEDULE_ID,
    occurrenceKey: OCCURRENCE_KEY,
    anyVisibleJoinEnabled: input.anyVisibleJoinEnabled ?? true,
    now: input.now ?? NOW,
  });
}

describe('resolveClassSessionJoinAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOccurrence();
  });

  it('lets a directly participating student join a future occurrence', async () => {
    const availability = await availabilityFor({
      profile: buildProfile(),
      supabase: createSupabaseStub({ memberProfileIds: ['profile-1'] }),
    });

    expect(availability.eligible).toBe(true);
    expect(availability.reason).toBeNull();
    expect(availability.action).toBe('join_integrated');
    expect(availability.occurrence).toEqual({
      orgId: ORG_ID,
      channelId: CHANNEL_ID,
      scheduleId: SCHEDULE_ID,
      occurrenceKey: OCCURRENCE_KEY,
    });
  });

  it('lets an educator named on the schedule join without a channel membership row', async () => {
    const availability = await availabilityFor({
      profile: buildProfile({ kind: 'educator' } as Partial<ProfileRow>),
      supabase: createSupabaseStub({ scheduleParticipantProfileIds: ['profile-1'] }),
    });

    expect(availability.eligible).toBe(true);
  });

  it('lets a guardian join through a linked participating child', async () => {
    const availability = await availabilityFor({
      profile: buildProfile({
        id: 'profile-guardian-1',
        kind: 'guardian',
        account_id: 'account-guardian-1',
      } as Partial<ProfileRow>),
      supabase: createSupabaseStub({
        memberProfileIds: ['profile-child-1'],
        familyLinks: [
          { guardianAccountId: 'account-guardian-1', childAccountId: 'account-child-1' },
        ],
        childProfiles: [{ id: 'profile-child-1', accountId: 'account-child-1' }],
      }),
    });

    expect(availability.eligible).toBe(true);
  });

  it('denies a guardian whose linked children do not participate', async () => {
    const availability = await availabilityFor({
      profile: buildProfile({
        id: 'profile-guardian-1',
        kind: 'guardian',
        account_id: 'account-guardian-1',
      } as Partial<ProfileRow>),
      supabase: createSupabaseStub({
        memberProfileIds: ['profile-other-child'],
        familyLinks: [
          { guardianAccountId: 'account-guardian-1', childAccountId: 'account-child-1' },
        ],
        childProfiles: [{ id: 'profile-child-1', accountId: 'account-child-1' }],
      }),
    });

    expect(availability.eligible).toBe(false);
    expect(availability.reason).toBe('not_authorized');
  });

  it('lets a staff observer join an in-organization occurrence they are not a member of', async () => {
    const availability = await availabilityFor({
      profile: buildProfile({
        id: 'profile-staff-1',
        kind: 'staff',
      } as Partial<ProfileRow>),
      supabase: createSupabaseStub({ memberProfileIds: [] }),
    });

    expect(availability.eligible).toBe(true);
  });

  it('denies an unrelated same-organization profile', async () => {
    const availability = await availabilityFor({
      profile: buildProfile({ id: 'profile-stranger' } as Partial<ProfileRow>),
      supabase: createSupabaseStub({ memberProfileIds: ['profile-1'] }),
    });

    expect(availability.eligible).toBe(false);
    expect(availability.reason).toBe('not_authorized');
  });

  it('reports a guessed or tampered occurrence identity as not found', async () => {
    mockOccurrence({ found: false });

    const availability = await availabilityFor({
      profile: buildProfile(),
      supabase: createSupabaseStub({ memberProfileIds: ['profile-1'] }),
    });

    expect(availability.eligible).toBe(false);
    expect(availability.reason).toBe('occurrence_not_found');
  });

  it('denies a cancelled occurrence', async () => {
    mockOccurrence({ isCancelled: true });

    const availability = await availabilityFor({
      profile: buildProfile(),
      supabase: createSupabaseStub({ memberProfileIds: ['profile-1'] }),
    });

    expect(availability.reason).toBe('occurrence_cancelled');
  });

  it('denies an occurrence in an archived classroom', async () => {
    const availability = await availabilityFor({
      profile: buildProfile(),
      supabase: createSupabaseStub({
        memberProfileIds: ['profile-1'],
        archived: true,
      }),
    });

    expect(availability.reason).toBe('classroom_archived');
  });

  it('denies a channel without live sessions configured', async () => {
    const availability = await availabilityFor({
      profile: buildProfile(),
      supabase: createSupabaseStub({
        memberProfileIds: ['profile-1'],
        liveSessionConfig: null,
      }),
    });

    expect(availability.reason).toBe('live_sessions_disabled');
  });

  it('denies an occurrence that ended more than the grace period ago', async () => {
    const availability = await availabilityFor({
      profile: buildProfile(),
      supabase: createSupabaseStub({ memberProfileIds: ['profile-1'] }),
      now: new Date('2026-04-10T12:00:00.000Z'),
    });

    expect(availability.reason).toBe('occurrence_past');
  });

  it('keeps a running-late occurrence joinable inside the grace period', async () => {
    const availability = await availabilityFor({
      profile: buildProfile(),
      supabase: createSupabaseStub({ memberProfileIds: ['profile-1'] }),
      now: new Date('2026-04-10T11:20:00.000Z'),
    });

    expect(availability.eligible).toBe(true);
  });

  it('reports an external provider occurrence as an open_external action', async () => {
    const availability = await availabilityFor({
      profile: buildProfile(),
      supabase: createSupabaseStub({
        memberProfileIds: ['profile-1'],
        liveSessionConfig: {
          enabled: true,
          provider: 'custom',
          joinUrl: 'https://meet.example.com/room',
        },
      }),
    });

    expect(availability.eligible).toBe(true);
    expect(availability.action).toBe('open_external');
  });

  describe('with the rollout flag off', () => {
    it('keeps a far-future occurrence non-joinable', async () => {
      const availability = await availabilityFor({
        profile: buildProfile(),
        supabase: createSupabaseStub({ memberProfileIds: ['profile-1'] }),
        anyVisibleJoinEnabled: false,
      });

      expect(availability.eligible).toBe(false);
      expect(availability.reason).toBe('feature_disabled');
    });

    it('still allows an occurrence inside the legacy 15-minute window', async () => {
      const availability = await availabilityFor({
        profile: buildProfile(),
        supabase: createSupabaseStub({ memberProfileIds: ['profile-1'] }),
        anyVisibleJoinEnabled: false,
        now: new Date('2026-04-10T09:50:00.000Z'),
      });

      expect(availability.eligible).toBe(true);
    });
  });
});

describe('joinClassSessionOccurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOccurrence();
  });

  it('creates the room under the selected occurrence scope, not a channel huddle', async () => {
    const supabase = createSupabaseStub({ memberProfileIds: ['profile-1'] });

    const result = await joinClassSessionOccurrence({
      serviceSupabase: supabase as never,
      orgId: ORG_ID,
      orgSlug: 'iconic-academy',
      profile: buildProfile(),
      scheduleId: SCHEDULE_ID,
      occurrenceKey: OCCURRENCE_KEY,
      anyVisibleJoinEnabled: true,
      now: NOW,
    });

    expect(supabase.state.inserted[0]).toMatchObject({
      session_scope_key: `occurrence:${OCCURRENCE_KEY}`,
      occurrence_key: OCCURRENCE_KEY,
    });
    expect(result.created).toBe(true);
    expect(result.occurrence.occurrenceKey).toBe(OCCURRENCE_KEY);
  });

  it('reuses an existing room for the same occurrence instead of creating a second', async () => {
    const supabase = createSupabaseStub({
      memberProfileIds: ['profile-1'],
      activeLiveSessionRow: {
        id: 'live-session-existing',
        org_id: ORG_ID,
        channel_id: CHANNEL_ID,
        provider: 'daily',
        session_scope_key: `occurrence:${OCCURRENCE_KEY}`,
        occurrence_key: OCCURRENCE_KEY,
        status: 'live',
        join_path: '/iconic-academy/live-sessions/live-session-existing',
      },
    });

    const result = await joinClassSessionOccurrence({
      serviceSupabase: supabase as never,
      orgId: ORG_ID,
      orgSlug: 'iconic-academy',
      profile: buildProfile(),
      scheduleId: SCHEDULE_ID,
      occurrenceKey: OCCURRENCE_KEY,
      anyVisibleJoinEnabled: true,
      now: NOW,
    });

    expect(result.created).toBe(false);
    expect(result.sessionId).toBe('live-session-existing');
    expect(supabase.state.inserted).toHaveLength(0);
  });

  it('refuses an unauthorized actor with the deny reason rather than creating a room', async () => {
    const supabase = createSupabaseStub({ memberProfileIds: ['someone-else'] });

    await expect(
      joinClassSessionOccurrence({
        serviceSupabase: supabase as never,
        orgId: ORG_ID,
        orgSlug: 'iconic-academy',
        profile: buildProfile({ id: 'profile-stranger' } as Partial<ProfileRow>),
        scheduleId: SCHEDULE_ID,
        occurrenceKey: OCCURRENCE_KEY,
        anyVisibleJoinEnabled: true,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(ClassSessionJoinDeniedError);

    expect(supabase.state.inserted).toHaveLength(0);
  });

  it('refuses a future occurrence when the rollout flag is off', async () => {
    const supabase = createSupabaseStub({ memberProfileIds: ['profile-1'] });

    await expect(
      joinClassSessionOccurrence({
        serviceSupabase: supabase as never,
        orgId: ORG_ID,
        orgSlug: 'iconic-academy',
        profile: buildProfile(),
        scheduleId: SCHEDULE_ID,
        occurrenceKey: OCCURRENCE_KEY,
        anyVisibleJoinEnabled: false,
        now: NOW,
      }),
    ).rejects.toMatchObject({ reason: 'feature_disabled' });

    expect(supabase.state.inserted).toHaveLength(0);
  });
});
