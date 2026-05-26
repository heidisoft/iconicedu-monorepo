import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

function makeMaybeSingleChain<T>(result: { data: T; error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => result),
  };
  return chain;
}

function makeReturnsChain<T>(result: { data: T; error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    not: jest.fn(() => chain),
    is: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    returns: jest.fn(async () => result),
  };
  return chain;
}

function makeUpdateChain(result: { error: null }) {
  const chain = {
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    not: jest.fn(() => chain),
    is: jest.fn(async () => result),
  };
  return {
    ...chain,
    lastEq: chain.eq,
    result,
  };
}

function buildScheduleRow() {
  return {
    id: 'schedule-1',
    org_id: 'org-1',
    title: 'Algebra',
    description: null,
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
    participants: [
      {
        id: 'participant-1',
        org_id: 'org-1',
        profile_id: 'profile-1',
        role: 'child',
        status: 'active',
        display_name: 'Alex Student',
        avatar_url: null,
        theme_key: null,
      },
    ],
    recurrence: null,
  };
}

describe('ReminderReconcileService', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reconciles the 12-hour and 30-minute reminder jobs for the next session', async () => {
    const scheduleChain = makeMaybeSingleChain({
      data: buildScheduleRow(),
      error: null,
    });
    const learningSpaceChain = makeMaybeSingleChain({
      data: { id: 'space-1', status: 'active', archived_at: null },
      error: null,
    });
    const succeededChain = makeReturnsChain({ data: [], error: null });
    const activeChain = makeReturnsChain({ data: [], error: null });
    const existingTwelveHourDedupeChain = makeMaybeSingleChain({
      data: { id: 'existing-reminder-job-1', status: 'canceled' },
      error: null,
    });
    const existingThirtyMinuteDedupeChain = makeMaybeSingleChain({
      data: null,
      error: null,
    });
    const updateChain = makeUpdateChain({ error: null });
    updateChain.eq.mockImplementation(() => updateChain);
    const insert = jest.fn(async () => ({ error: null }));

    const reminderJobsSelect = jest
      .fn()
      .mockImplementationOnce(() => succeededChain)
      .mockImplementationOnce(() => activeChain)
      .mockImplementationOnce(() => existingTwelveHourDedupeChain)
      .mockImplementationOnce(() => existingThirtyMinuteDedupeChain);
    const reminderJobsUpdate = jest.fn((payload: Record<string, unknown>) => {
      updateChain.update(payload);
      return updateChain;
    });

    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'class_schedules') {
          return { select: jest.fn(() => scheduleChain) };
        }
        if (table === 'learning_spaces') {
          return { select: jest.fn(() => learningSpaceChain) };
        }
        if (table === 'reminder_jobs') {
          return {
            select: reminderJobsSelect,
            update: reminderJobsUpdate,
            insert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result =
      await new ReminderReconcileService().reconcileNextReminderJobForSchedule({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        now: new Date('2030-03-05T16:00:00.000Z'),
      });

    expect(result).toEqual({
      action: 'inserted',
      dedupeKey: 'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:720',
      dedupeKeys: [
        'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:720',
        'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:30',
      ],
      insertedCount: 2,
      keptCount: 0,
      canceledCount: 0,
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        dedupe_key:
          'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:30',
        run_at: '2030-03-06T09:30:00.000Z',
      }),
    );
    expect(reminderJobsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        dedupe_key:
          'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:720',
        run_at: '2030-03-05T17:00:00.000Z',
      }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'existing-reminder-job-1');
    expect(updateChain.eq).toHaveBeenCalledWith('org_id', 'org-1');
  });

  it('schedules the 30-minute reminder immediately when the class is five minutes away', async () => {
    const scheduleChain = makeMaybeSingleChain({
      data: {
        ...buildScheduleRow(),
        start_at: '2030-03-06T10:05:00.000Z',
        end_at: '2030-03-06T11:05:00.000Z',
      },
      error: null,
    });
    const learningSpaceChain = makeMaybeSingleChain({
      data: { id: 'space-1', status: 'active', archived_at: null },
      error: null,
    });
    const succeededChain = makeReturnsChain({ data: [], error: null });
    const activeChain = makeReturnsChain({ data: [], error: null });
    const existingDedupeChain = makeMaybeSingleChain({
      data: null,
      error: null,
    });
    const insert = jest.fn(async () => ({ error: null }));

    const reminderJobsSelect = jest
      .fn()
      .mockImplementationOnce(() => succeededChain)
      .mockImplementationOnce(() => activeChain)
      .mockImplementationOnce(() => existingDedupeChain);

    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'class_schedules') {
          return { select: jest.fn(() => scheduleChain) };
        }
        if (table === 'learning_spaces') {
          return { select: jest.fn(() => learningSpaceChain) };
        }
        if (table === 'reminder_jobs') {
          return {
            select: reminderJobsSelect,
            insert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result =
      await new ReminderReconcileService().reconcileNextReminderJobForSchedule({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        now: new Date('2030-03-06T10:00:00.000Z'),
      });

    expect(result).toEqual({
      action: 'inserted',
      dedupeKey: 'session.reminder:org-1:space-1:channel-1:2030-03-06T10:05:00.000Z:30',
      dedupeKeys: [
        'session.reminder:org-1:space-1:channel-1:2030-03-06T10:05:00.000Z:30',
      ],
      insertedCount: 1,
      keptCount: 0,
      canceledCount: 0,
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        dedupe_key:
          'session.reminder:org-1:space-1:channel-1:2030-03-06T10:05:00.000Z:30',
        run_at: '2030-03-06T10:00:00.000Z',
        payload: expect.objectContaining({
          reminderOffsetMinutes: 30,
          summary: 'Class starts in 30 minutes',
        }),
      }),
    );
  });

  it('cancels stale active reminders and inserts reminders for the rescheduled time', async () => {
    const scheduleChain = makeMaybeSingleChain({
      data: {
        ...buildScheduleRow(),
        start_at: '2030-03-06T11:00:00.000Z',
        end_at: '2030-03-06T12:00:00.000Z',
      },
      error: null,
    });
    const learningSpaceChain = makeMaybeSingleChain({
      data: { id: 'space-1', status: 'active', archived_at: null },
      error: null,
    });
    const succeededChain = makeReturnsChain({ data: [], error: null });
    const activeChain = makeReturnsChain({
      data: [
        {
          id: 'old-reminder-job-1',
          dedupe_key:
            'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:5',
        },
      ],
      error: null,
    });
    const existingTwelveHourDedupeChain = makeMaybeSingleChain({
      data: null,
      error: null,
    });
    const existingThirtyMinuteDedupeChain = makeMaybeSingleChain({
      data: null,
      error: null,
    });
    const updateChain = makeUpdateChain({ error: null });
    updateChain.eq.mockImplementation(() => updateChain);
    const insert = jest.fn(async () => ({ error: null }));

    const reminderJobsSelect = jest
      .fn()
      .mockImplementationOnce(() => succeededChain)
      .mockImplementationOnce(() => activeChain)
      .mockImplementationOnce(() => existingTwelveHourDedupeChain)
      .mockImplementationOnce(() => existingThirtyMinuteDedupeChain);
    const reminderJobsUpdate = jest.fn((payload: Record<string, unknown>) => {
      updateChain.update(payload);
      return updateChain;
    });

    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'class_schedules') {
          return { select: jest.fn(() => scheduleChain) };
        }
        if (table === 'learning_spaces') {
          return { select: jest.fn(() => learningSpaceChain) };
        }
        if (table === 'reminder_jobs') {
          return {
            select: reminderJobsSelect,
            update: reminderJobsUpdate,
            insert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result =
      await new ReminderReconcileService().reconcileNextReminderJobForSchedule({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        now: new Date('2030-03-05T16:00:00.000Z'),
      });

    expect(result).toEqual({
      action: 'inserted',
      dedupeKey: 'session.reminder:org-1:space-1:channel-1:2030-03-06T11:00:00.000Z:720',
      dedupeKeys: [
        'session.reminder:org-1:space-1:channel-1:2030-03-06T11:00:00.000Z:720',
        'session.reminder:org-1:space-1:channel-1:2030-03-06T11:00:00.000Z:30',
      ],
      insertedCount: 2,
      keptCount: 0,
      canceledCount: 1,
    });
    expect(reminderJobsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'canceled',
        lease_owner: null,
        lease_until: null,
      }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'old-reminder-job-1');
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key:
          'session.reminder:org-1:space-1:channel-1:2030-03-06T11:00:00.000Z:720',
        run_at: '2030-03-05T17:00:00.000Z',
      }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key:
          'session.reminder:org-1:space-1:channel-1:2030-03-06T11:00:00.000Z:30',
        run_at: '2030-03-06T10:30:00.000Z',
      }),
    );
  });

  it('schedules a due completion check immediately when the rescheduled class already ended', async () => {
    const scheduleChain = makeMaybeSingleChain({
      data: {
        ...buildScheduleRow(),
        start_at: '2030-03-06T09:00:00.000Z',
        end_at: '2030-03-06T10:00:00.000Z',
      },
      error: null,
    });
    const learningSpaceChain = makeMaybeSingleChain({
      data: { id: 'space-1', status: 'active', archived_at: null },
      error: null,
    });
    const succeededChain = makeReturnsChain({ data: [], error: null });
    const activeChain = makeReturnsChain({ data: [], error: null });
    const existingDedupeChain = makeMaybeSingleChain({
      data: null,
      error: null,
    });
    const insert = jest.fn(async () => ({ error: null }));

    const reminderJobsSelect = jest
      .fn()
      .mockImplementationOnce(() => succeededChain)
      .mockImplementationOnce(() => activeChain)
      .mockImplementationOnce(() => existingDedupeChain);

    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'class_schedules') {
          return { select: jest.fn(() => scheduleChain) };
        }
        if (table === 'learning_spaces') {
          return { select: jest.fn(() => learningSpaceChain) };
        }
        if (table === 'reminder_jobs') {
          return {
            select: reminderJobsSelect,
            insert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result =
      await new ReminderReconcileService().reconcileNextReminderJobForSchedule({
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        now: new Date('2030-03-06T10:30:00.000Z'),
      });

    expect(result).toEqual({
      action: 'inserted',
      dedupeKey:
        'session.completion_check:org-1:space-1:channel-1:2030-03-06T09:00:00.000Z',
      dedupeKeys: [
        'session.completion_check:org-1:space-1:channel-1:2030-03-06T09:00:00.000Z',
      ],
      insertedCount: 1,
      keptCount: 0,
      canceledCount: 0,
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        job_type: 'session.completion_check',
        dedupe_key:
          'session.completion_check:org-1:space-1:channel-1:2030-03-06T09:00:00.000Z',
        run_at: '2030-03-06T10:30:00.000Z',
        payload: expect.objectContaining({
          summary: 'How was your class?',
        }),
      }),
    );
  });

  it.each(['completed', 'rescheduled'])(
    'cancels active reminders without scheduling new jobs when the schedule is %s',
    async (status) => {
      const scheduleChain = makeMaybeSingleChain({
        data: {
          ...buildScheduleRow(),
          status,
        },
        error: null,
      });
      const learningSpaceChain = makeMaybeSingleChain({
        data: { id: 'space-1', status: 'active', archived_at: null },
        error: null,
      });
      const updateChain = makeUpdateChain({ error: null });
      const reminderJobsUpdate = jest.fn((payload: Record<string, unknown>) => {
        updateChain.update(payload);
        return updateChain;
      });

      createSupabaseServiceClientMock.mockReturnValue({
        from: jest.fn((table: string) => {
          if (table === 'class_schedules') {
            return { select: jest.fn(() => scheduleChain) };
          }
          if (table === 'learning_spaces') {
            return { select: jest.fn(() => learningSpaceChain) };
          }
          if (table === 'reminder_jobs') {
            return {
              update: reminderJobsUpdate,
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      } as never);

      const result =
        await new ReminderReconcileService().reconcileNextReminderJobForSchedule({
          orgId: 'org-1',
          scheduleId: 'schedule-1',
          now: new Date('2030-03-06T09:00:00.000Z'),
        });

      expect(result).toEqual({ action: 'canceled_only' });
      expect(reminderJobsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'canceled',
          lease_owner: null,
          lease_until: null,
        }),
      );
      expect(updateChain.eq).toHaveBeenCalledWith('org_id', 'org-1');
      expect(updateChain.eq).toHaveBeenCalledWith('source_schedule_id', 'schedule-1');
      expect(updateChain.not).toHaveBeenCalledWith(
        'status',
        'in',
        '("succeeded","canceled","dead_letter")',
      );
      expect(updateChain.is).toHaveBeenCalledWith('deleted_at', null);
    },
  );
});
