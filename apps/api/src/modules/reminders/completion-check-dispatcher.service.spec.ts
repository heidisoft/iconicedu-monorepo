import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import { CompletionCheckDispatcherService } from '@iconicedu/api/modules/reminders/completion-check-dispatcher.service';

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(async () => ({ id: 'activity-event-1' })),
}));

describe('CompletionCheckDispatcherService', () => {
  const publishActivityEventMock = jest.mocked(publishActivityEvent);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeQuery<T>(initial: { data: T; error: null }) {
    let limitResult = initial;
    let maybeSingleResult: { data: unknown; error: null } = { data: null, error: null };
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      in: jest.fn(() => query),
      is: jest.fn(() => query),
      neq: jest.fn(() => query),
      gte: jest.fn(() => query),
      lte: jest.fn(() => query),
      upsert: jest.fn(() => query),
      limit: jest.fn(async () => limitResult),
      returns: jest.fn(async () => initial),
      maybeSingle: jest.fn(async () => maybeSingleResult),
      __setLimitResult: (result: typeof initial) => {
        limitResult = result;
      },
      __setMaybeSingleResult: (result: typeof maybeSingleResult) => {
        maybeSingleResult = result;
      },
    };
    return query;
  }

  type ScheduleRow = {
    id: string;
    title: string;
    status: string;
    end_at: string;
    source_channel_id: string | null;
    source_learning_space_id: string | null;
  };

  function makeSupabase(
    overrides: {
      schedule?: Partial<ScheduleRow>;
      recurrence?: { id: string } | null;
      exception?: { id: string } | null;
      override?: { patch: { endAt?: string | null } | null } | null;
      existingCompletion?: { id: string } | null;
      upsertedId?: string | null;
    } = {},
  ) {
    const existingCompletionsQuery = makeQuery({ data: [], error: null });
    if (overrides.existingCompletion) {
      existingCompletionsQuery.__setLimitResult({
        data: [overrides.existingCompletion],
        error: null,
      });
    }

    const upsertResultQuery = makeQuery({ data: null, error: null });
    upsertResultQuery.__setMaybeSingleResult({
      data: overrides.upsertedId ? { id: overrides.upsertedId } : null,
      error: null,
    });

    const classSessionCompletionsQuery = {
      select: jest.fn(() => existingCompletionsQuery),
      upsert: jest.fn(() => ({
        select: jest.fn(() => upsertResultQuery),
      })),
    };

    const scheduleRow: ScheduleRow = {
      id: 'schedule-1',
      title: 'Math with Ms. Shenaly',
      status: 'scheduled',
      end_at: '2030-03-06T11:00:00.000Z',
      source_channel_id: 'channel-1',
      source_learning_space_id: 'space-1',
      ...overrides.schedule,
    };

    const scheduleQuery = makeQuery({ data: [], error: null });
    scheduleQuery.__setMaybeSingleResult({ data: scheduleRow, error: null });

    const concurrentSchedulesQuery = makeQuery({ data: [], error: null });

    const recurrenceQuery = makeQuery({ data: [], error: null });
    recurrenceQuery.__setMaybeSingleResult({
      data: overrides.recurrence ?? null,
      error: null,
    });

    const exceptionQuery = makeQuery({ data: [], error: null });
    exceptionQuery.__setMaybeSingleResult({
      data: overrides.exception ?? null,
      error: null,
    });

    const overrideQuery = makeQuery({ data: [], error: null });
    overrideQuery.__setMaybeSingleResult({
      data: overrides.override ?? null,
      error: null,
    });

    const childProfilesQuery = makeQuery({
      data: [{ id: 'child-1', account_id: 'account-child-1', kind: 'child' }],
      error: null,
    });
    const familyLinksQuery = makeQuery({
      data: [
        {
          guardian_account_id: 'account-guardian-1',
          child_account_id: 'account-child-1',
        },
      ],
      error: null,
    });
    const guardianProfilesQuery = makeQuery({
      data: [
        {
          id: 'guardian-1',
          account_id: 'account-guardian-1',
          kind: 'guardian',
          display_name: 'Parent One',
          first_name: null,
          last_name: null,
          avatar_url: 'https://cdn.test/guardian.png',
          ui_theme_key: 'mint',
        },
      ],
      error: null,
    });

    let profilesCallCount = 0;
    let classSchedulesCallCount = 0;
    let classSessionCompletionsCallCount = 0;

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'class_session_completions') {
          classSessionCompletionsCallCount += 1;
          return classSessionCompletionsQuery;
        }
        if (table === 'family_links') {
          return { select: jest.fn(() => familyLinksQuery) };
        }
        if (table === 'class_schedules') {
          classSchedulesCallCount += 1;
          // Call 1: resolveEffectiveOccurrence's single-schedule fetch (.maybeSingle()).
          // Call 2+: dispatchGuardianCompletionCheck's concurrent-sessions lookup (.returns()).
          return {
            select: jest.fn(() =>
              classSchedulesCallCount === 1 ? scheduleQuery : concurrentSchedulesQuery,
            ),
          };
        }
        if (table === 'class_schedule_recurrence') {
          return { select: jest.fn(() => recurrenceQuery) };
        }
        if (table === 'class_schedule_recurrence_exceptions') {
          return { select: jest.fn(() => exceptionQuery) };
        }
        if (table === 'class_schedule_recurrence_overrides') {
          return { select: jest.fn(() => overrideQuery) };
        }
        if (table === 'profiles') {
          profilesCallCount += 1;
          return {
            select: jest.fn(() =>
              profilesCallCount === 1 ? childProfilesQuery : guardianProfilesQuery,
            ),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    return {
      supabase,
      getClassSessionCompletionsCallCount: () => classSessionCompletionsCallCount,
    };
  }

  const basePayload = {
    title: 'Math with Ms. Shenaly',
    summary: 'How was your class?',
    channelId: 'channel-1',
    learningSpaceId: 'space-1',
    scheduleId: 'schedule-1',
    occurrenceStart: '2030-03-06T10:00:00.000Z',
    startAt: '2030-03-06T10:00:00.000Z',
    endAt: '2030-03-06T11:00:00.000Z',
    channelRouteKind: 'space' as const,
    members: [
      {
        profileId: 'child-1',
        role: 'child' as const,
        displayName: 'Arya A',
        avatarUrl: null,
        themeKey: null,
      },
      {
        profileId: 'teacher-1',
        role: 'educator' as const,
        displayName: 'Ms. Shenaly',
        avatarUrl: null,
        themeKey: null,
      },
    ],
  };

  it('dispatches completion checks to linked parents even when they are not schedule participants', async () => {
    const { supabase } = makeSupabase({ upsertedId: 'completion-1' });
    const service = new CompletionCheckDispatcherService();

    await service.dispatchCompletionCheck({
      supabase: supabase as never,
      systemProfileId: 'system-profile-1',
      job: { id: 'job-1', org_id: 'org-1', source_schedule_id: 'schedule-1' } as never,
      payload: basePayload,
    });

    expect(publishActivityEventMock).toHaveBeenCalledTimes(3);
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.completion_check.sent',
        audienceRules: [{ kind: 'users_only', userIds: ['guardian-1'] }],
        dedupeKey:
          'session.completion_check:org-1:schedule-1:2030-03-06T10:00:00.000Z:guardian-1',
        payload: expect.objectContaining({
          title: 'Math with Ms. Shenaly',
          sessionCompletionId: 'completion-1',
          members: expect.arrayContaining([
            expect.objectContaining({
              profileId: 'child-1',
              role: 'child',
              displayName: 'Arya A',
            }),
            expect.objectContaining({
              profileId: 'teacher-1',
              role: 'educator',
              displayName: 'Ms. Shenaly',
            }),
          ]),
        }),
      }),
    );
  });

  it('skips dispatch entirely and never publishes when the session was cancelled', async () => {
    const { supabase } = makeSupabase({ schedule: { status: 'cancelled' } });
    const service = new CompletionCheckDispatcherService();

    const result = await service.dispatchCompletionCheck({
      supabase: supabase as never,
      systemProfileId: 'system-profile-1',
      job: { id: 'job-1', org_id: 'org-1', source_schedule_id: 'schedule-1' } as never,
      payload: basePayload,
    });

    expect(result).toEqual([]);
    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });

  it('skips a recurring occurrence with an exception (cancelled instance) even though the series is scheduled', async () => {
    const { supabase } = makeSupabase({
      recurrence: { id: 'recurrence-1' },
      exception: { id: 'exception-1' },
    });
    const service = new CompletionCheckDispatcherService();

    const result = await service.dispatchCompletionCheck({
      supabase: supabase as never,
      systemProfileId: 'system-profile-1',
      job: { id: 'job-1', org_id: 'org-1', source_schedule_id: 'schedule-1' } as never,
      payload: basePayload,
    });

    expect(result).toEqual([]);
    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });

  it('uses the override patched end time, not the original occurrence time, for a rescheduled recurring occurrence', async () => {
    const { supabase } = makeSupabase({
      recurrence: { id: 'recurrence-1' },
      override: { patch: { endAt: '2030-03-07T11:00:00.000Z' } },
      upsertedId: 'completion-2',
    });
    const service = new CompletionCheckDispatcherService();

    await service.dispatchCompletionCheck({
      supabase: supabase as never,
      systemProfileId: 'system-profile-1',
      job: { id: 'job-1', org_id: 'org-1', source_schedule_id: 'schedule-1' } as never,
      payload: { ...basePayload, members: [basePayload.members[1]] },
    });

    expect(publishActivityEventMock).toHaveBeenCalledTimes(1);
    // The occurrence_key (dedupeKey/payload.occurrenceStart) stays the ORIGINAL time —
    // only the effective session_end_at used for the completions row changes.
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey:
          'session.completion_check:org-1:schedule-1:2030-03-06T10:00:00.000Z:teacher-1',
      }),
    );
  });

  it('skips dispatch when a class_session_completions row already exists for this occurrence (idempotent)', async () => {
    const { supabase } = makeSupabase({
      existingCompletion: { id: 'completion-existing' },
    });
    const service = new CompletionCheckDispatcherService();

    const result = await service.dispatchCompletionCheck({
      supabase: supabase as never,
      systemProfileId: 'system-profile-1',
      job: { id: 'job-1', org_id: 'org-1', source_schedule_id: 'schedule-1' } as never,
      payload: basePayload,
    });

    expect(result).toEqual([]);
    expect(publishActivityEventMock).not.toHaveBeenCalled();
  });
});
