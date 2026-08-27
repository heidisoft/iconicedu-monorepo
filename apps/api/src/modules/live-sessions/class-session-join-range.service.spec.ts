import type { ClassScheduleVM, ProfileRow } from '@iconicedu/shared-types';

jest.mock('@iconicedu/api/lib/live-sessions/scope', () => ({
  resolveChannelLiveSessionScope: jest.fn(),
  resolveClassSessionOccurrenceScope: jest.fn(),
  buildOccurrenceScopeKey: (occurrenceKey: string) => `occurrence:${occurrenceKey}`,
}));

jest.mock('@iconicedu/api/lib/live-sessions/providers', () => ({
  getLiveSessionProvider: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/live-sessions/expected-participants', () => ({
  snapshotExpectedParticipantsForLiveSession: jest.fn(),
  getLiveSessionAttendancePolicy: jest.fn(() => ({})),
}));

jest.mock('@iconicedu/api/lib/schedules/class-schedule.builder', () => ({
  buildClassSchedulesByOrg: jest.fn(),
  buildClassSchedulesByIds: jest.fn(),
}));

import { buildClassSchedulesByOrg } from '@iconicedu/api/lib/schedules/class-schedule.builder';
import { resolveClassSessionJoinAvailabilityRange } from '@iconicedu/api/modules/live-sessions/live-sessions.service';

const ORG_ID = 'org-1';
const NOW = new Date('2026-04-06T09:00:00.000Z');
const FROM = '2026-04-06T00:00:00.000Z';
const TO = '2026-04-20T00:00:00.000Z';

function buildSchedule(input: {
  id: string;
  channelId: string;
  startAt: string;
}): ClassScheduleVM {
  return {
    ids: { id: input.id, orgId: ORG_ID },
    title: `Class ${input.id}`,
    description: null,
    location: null,
    meetingLink: null,
    startAt: input.startAt,
    endAt: new Date(new Date(input.startAt).getTime() + 60 * 60 * 1000).toISOString(),
    timezone: 'UTC',
    status: 'scheduled',
    visibility: 'participants',
    themeKey: null,
    participants: [],
    source: {
      kind: 'class_session',
      learningSpaceId: `space-${input.id}`,
      channelId: input.channelId,
    },
    audit: { createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'profile-1' },
  } as ClassScheduleVM;
}

function buildProfile(kind = 'child'): ProfileRow {
  return {
    id: 'profile-1',
    org_id: ORG_ID,
    account_id: 'account-1',
    kind,
  } as unknown as ProfileRow;
}

/**
 * Stub covering only the batched lookups the range path performs. Each returns a
 * flat row list, matching the real `.in(...)` queries.
 */
function createSupabaseStub(input?: {
  memberChannelIds?: string[];
  participatingScheduleIds?: string[];
  archivedSpaceIds?: string[];
  liveSessionChannelIds?: string[];
}) {
  const listBuilder = (data: unknown[]) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      is: () => builder,
      limit: () => builder,
      returns: async () => ({ data, error: null }),
    };
    return builder;
  };

  return {
    from(table: string) {
      if (table === 'channel_members') {
        return listBuilder(
          (input?.memberChannelIds ?? []).map((id) => ({ channel_id: id })),
        );
      }
      if (table === 'class_schedule_participants') {
        return listBuilder(
          (input?.participatingScheduleIds ?? []).map((id) => ({ schedule_id: id })),
        );
      }
      if (table === 'learning_spaces') {
        return listBuilder(
          (input?.archivedSpaceIds ?? []).map((id) => ({
            id,
            status: 'archived',
            archived_at: '2026-01-01T00:00:00.000Z',
          })),
        );
      }
      if (table === 'channels') {
        return listBuilder(
          (input?.liveSessionChannelIds ?? []).map((id) => ({
            id,
            live_session_config: { enabled: true, provider: 'daily', mode: 'video' },
          })),
        );
      }
      if (table === 'family_links') {
        return listBuilder([]);
      }
      if (table === 'profiles') {
        return listBuilder([]);
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function run(input: {
  profile?: ProfileRow;
  supabase: ReturnType<typeof createSupabaseStub>;
  anyVisibleJoinEnabled?: boolean;
}) {
  return resolveClassSessionJoinAvailabilityRange({
    serviceSupabase: input.supabase as never,
    orgId: ORG_ID,
    profile: input.profile ?? buildProfile(),
    fromAt: FROM,
    toAt: TO,
    anyVisibleJoinEnabled: input.anyVisibleJoinEnabled ?? true,
    now: NOW,
  });
}

describe('resolveClassSessionJoinAvailabilityRange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(buildClassSchedulesByOrg).mockResolvedValue([
      buildSchedule({
        id: 'mine',
        channelId: 'channel-mine',
        startAt: '2026-04-10T10:00:00.000Z',
      }),
      buildSchedule({
        id: 'someone-else',
        channelId: 'channel-other',
        startAt: '2026-04-11T10:00:00.000Z',
      }),
    ]);
  });

  it('omits occurrences the actor may not join instead of listing them as denied', async () => {
    const availability = await run({
      supabase: createSupabaseStub({
        memberChannelIds: ['channel-mine'],
        liveSessionChannelIds: ['channel-mine', 'channel-other'],
      }),
    });

    // Listing the other class — even as `not_authorized` — would leak its channel
    // id, schedule id and times to every authenticated member of the org.
    expect(availability).toHaveLength(1);
    expect(availability[0]!.occurrence.scheduleId).toBe('mine');
    expect(availability[0]!.eligible).toBe(true);
    expect(
      availability.some((entry) => entry.occurrence.channelId === 'channel-other'),
    ).toBe(false);
  });

  it('includes an occurrence the actor participates in via the schedule', async () => {
    const availability = await run({
      supabase: createSupabaseStub({
        participatingScheduleIds: ['someone-else'],
        liveSessionChannelIds: ['channel-mine', 'channel-other'],
      }),
    });

    expect(availability.map((entry) => entry.occurrence.scheduleId)).toEqual([
      'someone-else',
    ]);
  });

  it('lists every in-organization occurrence for a staff observer', async () => {
    const availability = await run({
      profile: buildProfile('staff'),
      supabase: createSupabaseStub({
        liveSessionChannelIds: ['channel-mine', 'channel-other'],
      }),
    });

    expect(availability).toHaveLength(2);
    availability.forEach((entry) => expect(entry.eligible).toBe(true));
  });

  it('reports an authorized occurrence in an archived classroom as ineligible', async () => {
    const availability = await run({
      supabase: createSupabaseStub({
        memberChannelIds: ['channel-mine'],
        liveSessionChannelIds: ['channel-mine'],
        archivedSpaceIds: ['space-mine'],
      }),
    });

    expect(availability).toHaveLength(1);
    expect(availability[0]!.eligible).toBe(false);
    expect(availability[0]!.reason).toBe('classroom_archived');
  });

  it('reports an authorized occurrence without live sessions as ineligible', async () => {
    const availability = await run({
      supabase: createSupabaseStub({
        memberChannelIds: ['channel-mine'],
        liveSessionChannelIds: [],
      }),
    });

    expect(availability[0]!.reason).toBe('live_sessions_disabled');
  });

  it('marks future occurrences ineligible when the rollout flag is off', async () => {
    const availability = await run({
      supabase: createSupabaseStub({
        memberChannelIds: ['channel-mine'],
        liveSessionChannelIds: ['channel-mine'],
      }),
      anyVisibleJoinEnabled: false,
    });

    expect(availability[0]!.eligible).toBe(false);
    expect(availability[0]!.reason).toBe('feature_disabled');
  });

  it('returns nothing for a malformed range', async () => {
    await expect(
      resolveClassSessionJoinAvailabilityRange({
        serviceSupabase: createSupabaseStub() as never,
        orgId: ORG_ID,
        profile: buildProfile(),
        fromAt: 'not-a-date',
        toAt: TO,
        anyVisibleJoinEnabled: true,
        now: NOW,
      }),
    ).resolves.toEqual([]);
  });
});
