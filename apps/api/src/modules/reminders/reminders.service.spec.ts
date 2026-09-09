import { ForbiddenException, Logger } from '@nestjs/common';
import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(async () => ({ id: 'activity-event-1' })),
}));

describe('RemindersService', () => {
  const analytics = { capture: jest.fn() };
  const reminderReconcileService = {
    reconcileNextReminderJobForSchedule: jest.fn(async () => ({ action: 'noop' })),
    reconcileAllSchedulesForLearningSpace: jest.fn(async () => ({ action: 'noop' })),
  };
  const completionCheckDispatcher = {
    dispatchCompletionCheck: jest.fn(
      async (_input: {
        job: { id: string };
      }): Promise<
        import('./completion-check-dispatcher.service').CompletionCheckDispatchResult
      > => ({ status: 'sent', activityEventIds: ['activity-event-1'] }),
    ),
    reconcileRecentCompletionChecks: jest.fn(async () => ({
      checked: 0,
      reconciled: 0,
      failed: 0,
    })),
  };
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);
  const publishActivityEventMock = jest.mocked(publishActivityEvent);
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    completionCheckDispatcher.dispatchCompletionCheck
      .mockReset()
      .mockResolvedValue({ status: 'sent', activityEventIds: ['activity-event-1'] });
    jest.useFakeTimers().setSystemTime(new Date('2030-03-01T00:00:00.000Z'));
    process.env.SUPABASE_URL = 'https://prod-ref.supabase.co';
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalSupabaseUrl;
    loggerLogSpy.mockRestore();
    loggerWarnSpy.mockRestore();
    jest.useRealTimers();
  });

  function makeChain<T>(result: { data: T; error: null } | { data: null; error: Error }) {
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      is: jest.fn(() => chain),
      in: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => result),
      returns: jest.fn(async () => result),
      update: jest.fn(() => chain),
      upsert: jest.fn(async () => ({ error: null })),
    };
    return chain;
  }

  function buildScheduleRow(input?: Partial<Record<string, unknown>>) {
    return {
      id: 'schedule-1',
      org_id: 'org-1',
      title: 'Algebra',
      description: 'Bring your workbook',
      location: null,
      meeting_link: null,
      start_at: '2030-03-06T10:00:00.000Z',
      end_at: '2030-03-06T11:00:00.000Z',
      timezone: 'UTC',
      status: 'scheduled',
      visibility: 'private',
      theme_key: null,
      source_kind: 'class_session',
      source_learning_space_id: 'space-1',
      source_channel_id: 'channel-1',
      source_session_id: null,
      source_owner_user_id: null,
      source_created_by_user_id: null,
      source_related_learning_space_id: null,
      created_at: '2030-01-01T00:00:00.000Z',
      created_by: 'profile-1',
      updated_at: '2030-01-01T00:00:00.000Z',
      updated_by: 'profile-1',
      deleted_at: null,
      deleted_by: null,
      source_learning_space: {
        status: 'active',
        archived_at: null,
      },
      participants: [
        {
          id: 'participant-1',
          org_id: 'org-1',
          profile_id: 'profile-1',
          role: 'child',
          status: 'active',
          display_name: 'Alex Student',
          avatar_url: 'https://cdn.test/alex.png',
          theme_key: 'blue',
        },
      ],
      recurrence: null,
      ...input,
    };
  }

  function makeCompileSupabase(input?: {
    account?: { id: string } | null;
    scheduleRows?: unknown[];
    existingRows?: Array<{ dedupe_key: string; status: string }>;
    staleRows?: Array<{ id: string; dedupe_key: string }>;
    deletedRows?: Array<{ id: string }>;
    legacyFeedbackRows?: Array<{ id: string }>;
  }) {
    const accountChain = makeChain({
      data: input?.account === undefined ? { id: 'account-1' } : input.account,
      error: null,
    });
    const schedulesChain = makeChain({
      data: input?.scheduleRows ?? [buildScheduleRow()],
      error: null,
    });
    const learningSpacesChain = makeChain({
      data: (input?.scheduleRows ?? [buildScheduleRow()]).map((row) => {
        const schedule = row as {
          source_learning_space_id?: string | null;
          source_learning_space?: {
            status?: string | null;
            archived_at?: string | null;
          } | null;
        };
        return {
          id: schedule.source_learning_space_id ?? 'space-1',
          status: schedule.source_learning_space?.status ?? 'active',
          archived_at: schedule.source_learning_space?.archived_at ?? null,
        };
      }),
      error: null,
    });
    const existingChain = makeChain({
      data: input?.existingRows ?? [],
      error: null,
    });
    const staleChain = makeChain({
      data: input?.staleRows ?? [],
      error: null,
    });
    const staleUpdateChain = {
      eq: jest.fn(() => staleUpdateChain),
      in: jest.fn(() => staleUpdateChain),
    };
    let deleteCallCount = 0;
    const deleteChain = {
      eq: jest.fn(() => deleteChain),
      not: jest.fn(() => deleteChain),
      select: jest.fn(() => deleteChain),
      returns: jest.fn(async () => {
        deleteCallCount += 1;
        return {
          data:
            deleteCallCount === 1
              ? (input?.deletedRows ?? [])
              : (input?.legacyFeedbackRows ?? []),
          error: null,
        };
      }),
    };
    const reminderJobsTable = {
      select: jest.fn((columns?: string) =>
        String(columns ?? '').includes('status') ? existingChain : staleChain,
      ),
      delete: jest.fn(() => deleteChain),
      upsert: jest.fn(async () => ({ error: null })),
      update: jest.fn(() => staleUpdateChain),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        switch (table) {
          case 'accounts':
            return { select: jest.fn(() => accountChain) };
          case 'class_schedules':
            return { select: jest.fn(() => schedulesChain) };
          case 'learning_spaces':
            return { select: jest.fn(() => learningSpacesChain) };
          case 'reminder_jobs':
            return reminderJobsTable;
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };
    return { supabase, reminderJobsTable };
  }

  function makeService() {
    return new RemindersService(
      analytics as never,
      reminderReconcileService as never,
      completionCheckDispatcher as never,
    );
  }

  it.each([
    ['dispatchDueReminderJobs', 'claim_due_org_reminder_jobs'],
    ['dispatchDueCompletionCheckJobs', 'claim_due_org_completion_check_jobs'],
  ] as const)(
    'scopes %s to one organization without global maintenance',
    async (method, claimRpc) => {
      const rpc = jest.fn(async () => ({ data: [], error: null }));
      const from = jest.fn();
      createSupabaseServiceClientMock.mockReturnValue({ rpc, from } as never);
      const result = await makeService()[method]({
        orgId: 'org-1',
        leaseOwner: 'admin-test',
      });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(
        claimRpc,
        expect.objectContaining({ p_org_id: 'org-1' }),
      );
      expect(from).not.toHaveBeenCalled();
      expect(
        completionCheckDispatcher.reconcileRecentCompletionChecks,
      ).not.toHaveBeenCalled();
      expect(result).toMatchObject({ claimed: 0, maintenanceSkipped: true });
    },
  );

  it('compiles two class reminders and one completion check for a learning space', async () => {
    const { supabase, reminderJobsTable } = makeCompileSupabase();
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    const result = await service.compileLearningSpaceReminderJobs('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    expect(result).toEqual({ compiledCount: 3, canceledCount: 0 });
    expect(reminderJobsTable.upsert).toHaveBeenCalledTimes(1);
    const compiledRows = reminderJobsTable.upsert.mock.calls[0]?.[0] as Array<{
      job_type: string;
      dedupe_key: string;
      run_at: string;
      payload: { summary?: string | null; members?: Array<{ profileId: string }> };
    }>;
    const reminderRows = compiledRows
      .filter((row) => row.job_type === 'session.reminder')
      .sort((a, b) => a.run_at.localeCompare(b.run_at));
    expect(reminderRows.map((row) => row.run_at)).toEqual([
      '2030-03-05T18:00:00.000Z',
      '2030-03-06T09:45:00.000Z',
    ]);
    expect(reminderRows.map((row) => row.payload.summary)).toEqual([
      'Class starts in 12 hours',
      'Class starts in 15 minutes',
    ]);
    expect(reminderRows[0]?.dedupe_key).toContain(':720');
    expect(reminderRows[1]?.dedupe_key).toContain(':15');
    const completionCheckRow = compiledRows.find(
      (row) => row.job_type === 'session.completion_check',
    );
    expect(completionCheckRow?.run_at).toBe('2030-03-06T11:10:00.000Z');
    expect(completionCheckRow?.payload.members?.[0]).toMatchObject({
      profileId: 'profile-1',
      role: 'child',
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('reminders org actor account resolved'),
    );
  });

  it('throws Forbidden when the token user has no account in the org', async () => {
    const { supabase } = makeCompileSupabase({ account: null });
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();

    await expect(
      service.compileLearningSpaceReminderJobs('token-1', {
        orgId: 'org-1',
        learningSpaceId: 'space-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('reminders org actor account missing'),
    );
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('accountFound'));
  });

  it('falls back to start time when end time is invalid for completion check scheduling', async () => {
    const { reminderJobsTable, supabase } = makeCompileSupabase({
      scheduleRows: [buildScheduleRow({ end_at: 'not-a-date' })],
    });
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    await service.compileLearningSpaceReminderJobs('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    const compiledRows = reminderJobsTable.upsert.mock.calls[0]?.[0] as Array<{
      job_type: string;
      run_at: string;
    }>;
    expect(
      compiledRows.find((row) => row.job_type === 'session.completion_check')?.run_at,
    ).toBe('2030-03-06T10:10:00.000Z');
  });

  it('does not reactivate succeeded reminder jobs when schedule ids change', async () => {
    const { reminderJobsTable, supabase } = makeCompileSupabase({
      scheduleRows: [buildScheduleRow({ id: 'schedule-2' })],
      existingRows: [
        {
          dedupe_key:
            'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:720',
          status: 'succeeded',
        },
        {
          dedupe_key:
            'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:30',
          status: 'succeeded',
        },
        {
          dedupe_key:
            'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:15',
          status: 'succeeded',
        },
        {
          dedupe_key:
            'session.completion_check:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z',
          status: 'succeeded',
        },
      ],
    });
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    const result = await service.compileLearningSpaceReminderJobs('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    expect(result.compiledCount).toBe(0);
    expect(reminderJobsTable.upsert).not.toHaveBeenCalled();
  });

  it('skips session reminders when reminder run_at is in the past', async () => {
    const now = Date.now();
    const occurrenceStart = new Date(now - 10 * 60 * 1000).toISOString();
    const occurrenceEnd = new Date(now + 50 * 60 * 1000).toISOString();
    const { reminderJobsTable, supabase } = makeCompileSupabase({
      scheduleRows: [
        buildScheduleRow({
          start_at: occurrenceStart,
          end_at: occurrenceEnd,
        }),
      ],
    });
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    await service.compileLearningSpaceReminderJobs('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    const compiledRows = reminderJobsTable.upsert.mock.calls[0]?.[0] as Array<{
      job_type: string;
    }>;
    expect(compiledRows.some((row) => row.job_type === 'session.reminder')).toBe(false);
    expect(compiledRows.some((row) => row.job_type === 'session.completion_check')).toBe(
      true,
    );
  });

  it('skips and cancels reminder jobs after a classroom archive cutoff', async () => {
    const { reminderJobsTable, supabase } = makeCompileSupabase({
      scheduleRows: [
        buildScheduleRow({
          source_learning_space: {
            status: 'archived',
            archived_at: '2030-03-06T09:00:00.000Z',
          },
        }),
      ],
      staleRows: [
        {
          id: 'stale-after-archive',
          dedupe_key:
            'session.completion_check:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z',
        },
      ],
    });
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    const result = await service.compileLearningSpaceReminderJobs('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    expect(result).toEqual({ compiledCount: 0, canceledCount: 1 });
    expect(reminderJobsTable.upsert).not.toHaveBeenCalled();
  });

  it('keeps reminder jobs before or on the classroom archive cutoff', async () => {
    const { reminderJobsTable, supabase } = makeCompileSupabase({
      scheduleRows: [
        buildScheduleRow({
          source_learning_space: {
            status: 'archived',
            archived_at: '2030-03-06T10:00:00.000Z',
          },
        }),
      ],
    });
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    await service.compileLearningSpaceReminderJobs('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    const compiledRows = reminderJobsTable.upsert.mock.calls[0]?.[0] as Array<{
      job_type: string;
    }>;
    expect(compiledRows.map((row) => row.job_type)).toEqual([
      'session.reminder',
      'session.reminder',
    ]);
  });

  it('resets queued org reminder jobs, removes legacy feedback jobs, and precompiles completion checks', async () => {
    const { reminderJobsTable, supabase } = makeCompileSupabase({
      deletedRows: [{ id: 'queued-job-1' }, { id: 'dead-letter-job-1' }],
      legacyFeedbackRows: [{ id: 'legacy-feedback-job-1' }],
    });
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    const result = await service.resetAndReconcileOrgReminderJobs('org-1');

    expect(result).toEqual({
      canceledCount: 2,
      legacyFeedbackDeletedCount: 1,
      staleCanceledCount: 0,
      compiledCount: 3,
      reconciledCount: 1,
      scheduleCount: 1,
      learningSpaceCount: 1,
    });
    expect(reminderJobsTable.delete).toHaveBeenCalledTimes(2);
    expect(reminderJobsTable.upsert).toHaveBeenCalledTimes(1);
    const compiledRows = reminderJobsTable.upsert.mock.calls[0]?.[0] as Array<{
      job_type: string;
    }>;
    expect(compiledRows.map((row) => row.job_type)).toEqual([
      'session.reminder',
      'session.reminder',
      'session.completion_check',
    ]);
  });

  it('cancels pending, leased, and failed learning-space reminder jobs', async () => {
    const accountChain = makeChain({ data: { id: 'account-1' }, error: null });
    const updateChain = {
      eq: jest.fn(() => updateChain),
      in: jest.fn(() => updateChain),
      is: jest.fn(async () => ({ error: null })),
    };
    const reminderJobsUpdate = jest.fn(() => updateChain);
    const supabase = {
      from: jest.fn((table: string) => {
        switch (table) {
          case 'accounts':
            return { select: jest.fn(() => accountChain) };
          case 'reminder_jobs':
            return { update: reminderJobsUpdate };
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    await expect(
      service.cancelLearningSpaceReminderJobs('token-1', {
        orgId: 'org-1',
        learningSpaceId: 'space-1',
      }),
    ).resolves.toEqual({ success: true });
    expect(reminderJobsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled', lease_owner: null }),
    );
    expect(updateChain.in).toHaveBeenCalledWith('status', [
      'pending',
      'leased',
      'failed',
    ]);
  });

  it('dispatches only precompiled reminder_jobs and does not read schedules', async () => {
    const claimedJob = {
      id: 'job-1',
      org_id: 'org-1',
      job_type: 'session.reminder',
      target_kind: 'channel',
      target_id: 'channel-1',
      source_learning_space_id: 'space-1',
      source_schedule_id: 'schedule-1',
      timezone: 'America/New_York',
      payload: {
        title: 'Algebra',
        summary: 'Class starts in 15 minutes',
        reminderOffsetMinutes: 15,
        timezone: 'America/New_York',
        channelId: 'channel-1',
        learningSpaceId: 'space-1',
        scheduleId: 'schedule-1',
        occurrenceStart: '2030-03-06T10:00:00.000Z',
      },
      dedupe_key: 'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:15',
      attempt_count: 0,
      max_attempts: 8,
    };

    const profilesSelectChain = {
      eq: jest.fn(() => profilesSelectChain),
      is: jest.fn(() => profilesSelectChain),
      order: jest.fn(() => profilesSelectChain),
      limit: jest.fn(() => profilesSelectChain),
      maybeSingle: jest.fn(async () => ({
        data: { id: 'system-profile-1' },
        error: null,
      })),
    };

    const reminderJobsUpdateChain = {
      eq: jest.fn(() => reminderJobsUpdateChain),
    };

    const supabase = {
      rpc: jest.fn(async (fn: string) => {
        if (fn === 'claim_due_reminder_jobs') {
          return { data: [claimedJob], error: null };
        }
        if (fn === 'run_stale_activity_cleanup') {
          return {
            data: [
              {
                notifications_marked_read: 2,
                completion_votes_marked_completed: 3,
                sessions_marked_completed: 1,
              },
            ],
            error: null,
          };
        }
        if (fn === 'run_class_session_completion_expiry_sweep') {
          return {
            data: [
              {
                completions_auto_confirmed: 4,
                sessions_marked_completed: 2,
              },
            ],
            error: null,
          };
        }
        throw new Error(`Unexpected rpc ${fn}`);
      }),
      from: jest.fn((table: string) => {
        switch (table) {
          case 'profiles':
            return { select: jest.fn(() => profilesSelectChain) };
          case 'reminder_jobs':
            return { update: jest.fn(() => reminderJobsUpdateChain) };
          case 'learning_spaces':
            return {
              select: jest.fn(() =>
                makeChain({ data: { status: 'active', archived_at: null }, error: null }),
              ),
            };
          case 'reminder_dispatch_logs':
            return { insert: jest.fn(async () => ({ error: null })) };
          case 'class_schedules':
          case 'class_schedule_recurrence':
          case 'class_schedule_participants':
          case 'class_schedule_recurrence_exceptions':
          case 'class_schedule_recurrence_overrides':
            throw new Error(`Reminder dispatch must not read ${table}`);
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = makeService();
    const result = await service.dispatchDueReminderJobs({
      leaseOwner: 'supabase-edge-cron',
      limit: 10,
      leaseSeconds: 90,
    });

    expect(result.claimed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.staleCleanup).toEqual({
      notificationsMarkedRead: 2,
      completionVotesMarkedCompleted: 4,
      sessionsMarkedCompleted: 2,
      legacyCompletionVotesMarkedCompleted: 3,
      legacySessionsMarkedCompleted: 1,
      failed: false,
    });
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.reminder.sent',
        dedupeKey: `${claimedJob.dedupe_key}:activity`,
        payload: expect.objectContaining({
          title: 'Algebra',
          learningSpaceTitle: 'Algebra',
          channelRouteKind: 'space',
        }),
      }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith('claim_due_reminder_jobs', {
      p_limit: 10,
      p_lease_owner: 'supabase-edge-cron',
      p_lease_seconds: 90,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('run_stale_activity_cleanup');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'run_class_session_completion_expiry_sweep',
    );
    expect(supabase.from).not.toHaveBeenCalledWith('class_schedules');
  });
  function makeCompletionDispatchSupabase() {
    const updates: Array<{ id?: string; values: Record<string, unknown> }> = [];
    const jobs = [1, 2, 3].map((index) => ({
      id: `completion-job-${index}`,
      org_id: 'org-1',
      job_type: 'session.completion_check',
      source_schedule_id: `schedule-${index}`,
      payload: {},
      attempt_count: 0,
      max_attempts: 8,
    }));
    const rpc = jest.fn(async (name: string) => ({
      data: name === 'claim_due_completion_check_jobs' ? jobs : [],
      error: null,
    }));
    const supabase = {
      rpc,
      from: jest.fn((table: string) => {
        if (table === 'reminder_jobs')
          return {
            update: (values: Record<string, unknown>) => {
              const update = { values, id: undefined as string | undefined };
              updates.push(update);
              const chain = {
                eq: (key: string, value: string) => {
                  if (key === 'id') update.id = value;
                  return chain;
                },
              };
              return chain;
            },
          };
        if (table === 'profiles')
          return { select: () => makeChain({ data: { id: 'system-1' }, error: null }) };
        if (table === 'reminder_dispatch_logs')
          return { insert: jest.fn(async () => ({ error: null })) };
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);
    return { supabase, updates };
  }

  it('dispatches three completion jobs independently and only succeeds after publishing', async () => {
    const { supabase, updates } = makeCompletionDispatchSupabase();
    completionCheckDispatcher.dispatchCompletionCheck.mockImplementation(
      async ({ job }: { job: { id: string } }) => {
        expect(
          updates.some(
            (update) => update.id === job.id && update.values.status === 'succeeded',
          ),
        ).toBe(false);
        return { status: 'sent', activityEventIds: [`event-${job.id}`] };
      },
    );
    const result = await makeService().dispatchDueCompletionCheckJobs({
      leaseOwner: 'completion-worker',
    });
    expect(result).toMatchObject({ claimed: 3, succeeded: 3, failed: 0 });
    expect(completionCheckDispatcher.dispatchCompletionCheck).toHaveBeenCalledTimes(3);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'claim_due_completion_check_jobs',
      expect.any(Object),
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'claim_due_reminder_jobs',
      expect.anything(),
    );
  });

  it('keeps a moved session pending and continues the other completion jobs', async () => {
    const { updates } = makeCompletionDispatchSupabase();
    completionCheckDispatcher.dispatchCompletionCheck.mockResolvedValueOnce({
      status: 'deferred',
      runAt: '2030-03-02T13:10:00.000Z',
    });
    const result = await makeService().dispatchDueCompletionCheckJobs({
      leaseOwner: 'completion-worker',
    });
    expect(result).toMatchObject({ claimed: 3, succeeded: 2, skipped: 1 });
    expect(updates).toContainEqual(
      expect.objectContaining({
        id: 'completion-job-1',
        values: expect.objectContaining({
          status: 'pending',
          run_at: '2030-03-02T13:10:00.000Z',
          completion_reconciled_at: null,
        }),
      }),
    );
    expect(
      updates.some(
        (update) =>
          update.id === 'completion-job-1' && update.values.status === 'succeeded',
      ),
    ).toBe(false);
  });

  it('retries a publication failure without blocking the other two classes', async () => {
    const { updates } = makeCompletionDispatchSupabase();
    completionCheckDispatcher.dispatchCompletionCheck.mockRejectedValueOnce(
      new Error('publication temporarily unavailable'),
    );
    const result = await makeService().dispatchDueCompletionCheckJobs({
      leaseOwner: 'completion-worker',
    });
    expect(result).toMatchObject({ claimed: 3, succeeded: 2, failed: 1 });
    expect(updates).toContainEqual(
      expect.objectContaining({
        id: 'completion-job-1',
        values: expect.objectContaining({ status: 'failed', attempt_count: 1 }),
      }),
    );
    expect(
      updates.some(
        (update) =>
          update.id === 'completion-job-1' && update.values.status === 'succeeded',
      ),
    ).toBe(false);
  });
});
