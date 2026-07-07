import { ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(async () => null),
}));

describe('SchedulesService authorization', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);
  const publishActivityEventMock = jest.mocked(publishActivityEvent);

  function makeSingleResult<T>(result: T) {
    const chain = {
      from: jest.fn(() => chain),
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      is: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => ({ data: result, error: null })),
      returns: jest.fn(async () => ({ data: result, error: null })),
    };
    return chain;
  }

  async function requireOrgActorWithRoles(roleKeys: string[]) {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(
        makeSingleResult(roleKeys.map((role_key) => ({ role_key }))) as never,
      );

    const service = new SchedulesService();
    return (
      service as unknown as {
        requireOrgActor(
          accessToken: string,
          orgId: string,
        ): Promise<{ accountId: string; profileId: string | null }>;
      }
    ).requireOrgActor('token-1', 'org-1');
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['owner', 'admin', 'staff'])(
    'allows %s to manage learning-space schedules',
    async (roleKey) => {
      await expect(requireOrgActorWithRoles([roleKey])).resolves.toEqual({
        accountId: 'account-1',
        profileId: 'profile-staff',
      });
    },
  );

  it('rejects non-manager org members', async () => {
    await expect(requireOrgActorWithRoles(['guardian'])).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows guardians to self-serve sessions for linked child participants', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-guardian' } },
          error: null,
        })),
      },
    } as never);

    const participantLookups = [
      { data: null, error: null },
      { data: { profile_id: 'profile-child' }, error: null },
    ];
    const mainClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          in: jest.fn(() => query),
          is: jest.fn(() => query),
          limit: jest.fn(() => query),
          maybeSingle: jest.fn(async () => {
            if (table === 'class_schedule_participants') {
              return participantLookups.shift() ?? { data: null, error: null };
            }
            if (table === 'profiles') {
              return { data: { display_name: 'Taylor Parent' }, error: null };
            }
            return { data: null, error: null };
          }),
          returns: jest.fn(async () => {
            if (table === 'family_links') {
              return { data: [{ child_account_id: 'account-child' }], error: null };
            }
            if (table === 'profiles') {
              return { data: [{ id: 'profile-child' }], error: null };
            }
            if (table === 'user_roles') {
              return { data: [{ role_key: 'guardian' }], error: null };
            }
            return { data: [], error: null };
          }),
        };
        return query;
      }),
    };

    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-guardian',
          active_profile_id: 'profile-guardian',
        }) as never,
      )
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService();
    const actor = await (
      service as unknown as {
        requireSessionParticipantActor(
          accessToken: string,
          input: { orgId: string; scheduleId: string },
        ): Promise<{
          accountId: string;
          profileId: string;
          role: string;
          displayName: string | null;
          roleKeys: string[];
        }>;
      }
    ).requireSessionParticipantActor('token-1', {
      orgId: 'org-1',
      scheduleId: 'schedule-1',
    });

    expect(actor).toEqual({
      accountId: 'account-guardian',
      profileId: 'profile-guardian',
      role: 'guardian',
      displayName: 'Taylor Parent',
      roleKeys: ['guardian'],
    });
    expect(mainClient.from).toHaveBeenCalledWith('family_links');
  });

  it('lets the original self-serve canceller undo a recurring cancellation', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-guardian' } },
          error: null,
        })),
      },
    } as never);

    const deletes: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
    const mainClient = {
      from: jest.fn((table: string) => {
        const filters: Array<[string, unknown]> = [];
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn((key: string, value: unknown) => {
            filters.push([key, value]);
            return query;
          }),
          is: jest.fn(() => query),
          delete: jest.fn(() => {
            deletes.push({ table, filters });
            return query;
          }),
          maybeSingle: jest.fn(async () => {
            if (table === 'class_schedules') {
              return {
                data: {
                  id: 'schedule-1',
                  title: 'Algebra I',
                  start_at: '2030-03-06T10:00:00.000Z',
                  end_at: '2030-03-06T11:00:00.000Z',
                  timezone: 'America/New_York',
                  source_learning_space_id: 'space-1',
                  source_channel_id: 'channel-1',
                  participants: [],
                },
                error: null,
              };
            }
            if (table === 'learning_spaces') {
              return { data: { status: 'active', archived_at: null }, error: null };
            }
            if (table === 'class_schedule_recurrence') {
              return { data: { id: 'recurrence-1' }, error: null };
            }
            if (table === 'class_schedule_recurrence_exceptions') {
              return {
                data: { id: 'exception-1', created_by: 'profile-guardian' },
                error: null,
              };
            }
            return { data: null, error: null };
          }),
        };
        return query;
      }),
    };
    const participantClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          is: jest.fn(() => query),
          maybeSingle: jest.fn(async () => ({
            data:
              table === 'class_schedule_participants'
                ? { role: 'guardian', display_name: 'Taylor Parent' }
                : null,
            error: null,
          })),
          returns: jest.fn(async () => ({
            data: table === 'user_roles' ? [{ role_key: 'guardian' }] : [],
            error: null,
          })),
        };
        return query;
      }),
    };
    const reconcileNextReminderJobForSchedule = jest.fn(async () => ({
      action: 'inserted',
    }));

    createSupabaseServiceClientMock
      .mockReturnValueOnce(mainClient as never)
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-guardian',
          active_profile_id: 'profile-guardian',
        }) as never,
      )
      .mockReturnValueOnce(participantClient as never);

    const service = new SchedulesService({
      reconcileNextReminderJobForSchedule,
    } as never);
    await expect(
      service.selfServeUndoCancelSession('token-1', {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2030-03-06T10:00:00.000Z',
      }),
    ).resolves.toEqual({ success: true, mode: 'recurring' });

    expect(deletes).toContainEqual({
      table: 'class_schedule_recurrence_exceptions',
      filters: expect.arrayContaining([
        ['id', 'exception-1'],
        ['org_id', 'org-1'],
      ]),
    });
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'class.session.cancel_restored',
        actorProfileId: 'profile-guardian',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        audienceRules: [{ kind: 'all_in_scope' }],
        dedupeKey:
          'class.session.cancel_restored:org-1:schedule-1:2030-03-06T10:00:00.000Z',
        refreshOnDedupe: true,
        payload: expect.objectContaining({
          title: 'Algebra I',
          channelId: 'channel-1',
          learningSpaceId: 'space-1',
          restoredStartAt: '2030-03-06T10:00:00.000Z',
          restoredEndAt: '2030-03-06T11:00:00.000Z',
          timezone: 'America/New_York',
        }),
      }),
    );
    expect(reconcileNextReminderJobForSchedule).toHaveBeenCalledWith({
      orgId: 'org-1',
      scheduleId: 'schedule-1',
    });
  });

  it('falls back to the account profile when active_profile_id is missing', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({ id: 'account-1', active_profile_id: null }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(makeSingleResult({ id: 'profile-fallback' }) as never);

    const service = new SchedulesService();
    const actor = await (
      service as unknown as {
        requireOrgActor(
          accessToken: string,
          orgId: string,
        ): Promise<{ accountId: string; profileId: string | null }>;
      }
    ).requireOrgActor('token-1', 'org-1');

    expect(actor).toEqual({
      accountId: 'account-1',
      profileId: 'profile-fallback',
    });
  });

  it('reschedules recurring sessions by deleting cancellations and upserting overrides', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const operations: Array<{ table: string; action: string; payload?: unknown }> = [];
    const mainClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          is: jest.fn(() => query),
          order: jest.fn(() => query),
          in: jest.fn(() => query),
          delete: jest.fn(() => {
            operations.push({ table, action: 'delete' });
            return query;
          }),
          insert: jest.fn((payload: unknown) => {
            operations.push({ table, action: 'insert', payload });
            return Promise.resolve({ data: null, error: null });
          }),
          update: jest.fn((payload: unknown) => {
            operations.push({ table, action: 'update', payload });
            return query;
          }),
          maybeSingle: jest.fn(async () => {
            if (table === 'class_schedule_recurrence') {
              return { data: { id: 'recurrence-1' }, error: null };
            }
            return { data: null, error: null };
          }),
          returns: jest.fn(async () => {
            if (table === 'class_schedule_recurrence_overrides') {
              return { data: [], error: null };
            }
            return { data: [], error: null };
          }),
        };
        return query;
      }),
    };
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService();
    await expect(
      service.rescheduleScheduleSession('token-1', {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        startAt: '2026-03-22T15:30:00.000Z',
        endAt: '2026-03-22T16:45:00.000Z',
        timezone: 'America/New_York',
        reason: 'Family requested a change',
        suppressNotifications: true,
      }),
    ).resolves.toEqual({ success: true, mode: 'recurring' });

    expect(operations).toEqual([
      { table: 'class_schedule_recurrence_exceptions', action: 'delete' },
      {
        table: 'class_schedule_recurrence_overrides',
        action: 'insert',
        payload: expect.objectContaining({
          org_id: 'org-1',
          recurrence_id: 'recurrence-1',
          occurrence_key: '2026-03-21T14:00:00.000Z',
          patch: {
            startAt: '2026-03-22T15:30:00.000Z',
            endAt: '2026-03-22T16:45:00.000Z',
            reason: 'Family requested a change',
          },
          suppress_notifications: true,
          created_by: 'profile-staff',
          updated_by: 'profile-staff',
        }),
      },
    ]);
  });

  it('publishes a reschedule activity and reconciles reminders for one-off sessions', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const reconcileNextReminderJobForSchedule = jest.fn(async () => ({
      action: 'inserted',
    }));
    const mainClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          is: jest.fn(() => query),
          update: jest.fn(() => query),
          maybeSingle: jest.fn(async () => {
            if (table === 'class_schedules') {
              return {
                data: {
                  id: 'schedule-1',
                  title: 'Algebra I',
                  start_at: '2030-03-06T10:00:00.000Z',
                  end_at: '2030-03-06T11:00:00.000Z',
                  timezone: 'America/New_York',
                  source_learning_space_id: 'space-1',
                  source_channel_id: 'channel-1',
                  participants: [
                    {
                      profile_id: 'student-1',
                      role: 'child',
                      display_name: 'Priya',
                      avatar_url: null,
                      theme_key: null,
                    },
                  ],
                },
                error: null,
              };
            }
            if (table === 'class_schedule_recurrence') {
              return { data: null, error: null };
            }
            return { data: null, error: null };
          }),
        };
        return query;
      }),
    };
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService({
      reconcileNextReminderJobForSchedule,
    } as never);

    await expect(
      service.rescheduleScheduleSession('token-1', {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: null,
        startAt: '2030-03-06T10:05:00.000Z',
        endAt: '2030-03-06T11:05:00.000Z',
        timezone: 'America/New_York',
        reason: 'Traffic delay',
        suppressNotifications: true,
      }),
    ).resolves.toEqual({ success: true, mode: 'single' });

    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'class.session.rescheduled',
        actorProfileId: 'profile-staff',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        audienceRules: [{ kind: 'all_in_scope' }],
        dedupeKey: 'class.session.rescheduled:org-1:schedule-1:2030-03-06T10:00:00.000Z',
        refreshOnDedupe: true,
        payload: expect.objectContaining({
          title: 'Algebra I',
          channelId: 'channel-1',
          learningSpaceId: 'space-1',
          rescheduledFromStartAt: '2030-03-06T10:00:00.000Z',
          rescheduledFromEndAt: '2030-03-06T11:00:00.000Z',
          rescheduledToStartAt: '2030-03-06T10:05:00.000Z',
          rescheduledToEndAt: '2030-03-06T11:05:00.000Z',
          rescheduledReason: 'Traffic delay',
          timezone: 'America/New_York',
          suppressNotifications: true,
          members: [
            {
              profileId: 'student-1',
              role: 'child',
              displayName: 'Priya',
              avatarUrl: null,
              themeKey: null,
            },
          ],
        }),
      }),
    );
    expect(reconcileNextReminderJobForSchedule).toHaveBeenCalledWith({
      orgId: 'org-1',
      scheduleId: 'schedule-1',
    });
  });

  it('uses the recurring override dedupe key for immediate reschedule activity', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const reconcileNextReminderJobForSchedule = jest.fn(async () => ({
      action: 'inserted',
    }));
    const mainClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          is: jest.fn(() => query),
          delete: jest.fn(() => query),
          order: jest.fn(() => query),
          insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
          update: jest.fn(() => query),
          maybeSingle: jest.fn(async () => {
            if (table === 'class_schedules') {
              return {
                data: {
                  id: 'schedule-1',
                  title: 'Algebra I',
                  start_at: '2030-03-06T10:00:00.000Z',
                  end_at: '2030-03-06T11:00:00.000Z',
                  timezone: 'America/New_York',
                  source_learning_space_id: 'space-1',
                  source_channel_id: 'channel-1',
                  participants: [],
                },
                error: null,
              };
            }
            if (table === 'class_schedule_recurrence') {
              return { data: { id: 'recurrence-1' }, error: null };
            }
            return { data: null, error: null };
          }),
          returns: jest.fn(async () => {
            if (table === 'class_schedule_recurrence_overrides') {
              return {
                data: [
                  {
                    id: 'override-1',
                    patch: {
                      startAt: '2030-03-13T10:30:00.000Z',
                      endAt: '2030-03-13T11:30:00.000Z',
                    },
                    updated_at: '2030-03-01T00:00:00.000Z',
                    created_at: '2030-03-01T00:00:00.000Z',
                  },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          }),
        };
        return query;
      }),
    };
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService({
      reconcileNextReminderJobForSchedule,
    } as never);

    await expect(
      service.rescheduleScheduleSession('token-1', {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2030-03-13T10:00:00.000Z',
        startAt: '2030-03-13T11:00:00.000Z',
        endAt: '2030-03-13T12:00:00.000Z',
        timezone: 'America/New_York',
        reason: null,
        suppressNotifications: false,
      }),
    ).resolves.toEqual({ success: true, mode: 'recurring' });

    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'class.session.rescheduled',
        dedupeKey: 'class.session.rescheduled:org-1:override-1',
        refreshOnDedupe: true,
        payload: expect.objectContaining({
          rescheduledFromStartAt: '2030-03-13T10:30:00.000Z',
          rescheduledFromEndAt: '2030-03-13T11:30:00.000Z',
          rescheduledToStartAt: '2030-03-13T11:00:00.000Z',
          rescheduledToEndAt: '2030-03-13T12:00:00.000Z',
          suppressNotifications: false,
        }),
      }),
    );
    expect(reconcileNextReminderJobForSchedule).toHaveBeenCalledWith({
      orgId: 'org-1',
      scheduleId: 'schedule-1',
    });
  });

  it('updates one recurring override and deletes duplicate overrides for the same occurrence', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const operations: Array<{ table: string; action: string; payload?: unknown }> = [];
    const mainClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          is: jest.fn(() => query),
          in: jest.fn(() => query),
          order: jest.fn(() => query),
          delete: jest.fn(() => {
            operations.push({ table, action: 'delete' });
            return query;
          }),
          insert: jest.fn((payload: unknown) => {
            operations.push({ table, action: 'insert', payload });
            return Promise.resolve({ data: null, error: null });
          }),
          update: jest.fn((payload: unknown) => {
            operations.push({ table, action: 'update', payload });
            return query;
          }),
          maybeSingle: jest.fn(async () => {
            if (table === 'class_schedules') {
              return {
                data: {
                  id: 'schedule-1',
                  title: 'Algebra I',
                  start_at: '2030-03-06T10:00:00.000Z',
                  end_at: '2030-03-06T11:00:00.000Z',
                  timezone: 'America/New_York',
                  source_learning_space_id: 'space-1',
                  source_channel_id: 'channel-1',
                  participants: [],
                },
                error: null,
              };
            }
            if (table === 'class_schedule_recurrence') {
              return { data: { id: 'recurrence-1' }, error: null };
            }
            return { data: null, error: null };
          }),
          returns: jest.fn(async () => {
            if (table === 'class_schedule_recurrence_overrides') {
              return {
                data: [
                  {
                    id: 'override-keep',
                    patch: {
                      startAt: '2030-03-13T10:30:00.000Z',
                      endAt: '2030-03-13T11:30:00.000Z',
                    },
                    updated_at: '2030-03-02T00:00:00.000Z',
                    created_at: '2030-03-02T00:00:00.000Z',
                  },
                  {
                    id: 'override-delete-a',
                    patch: {
                      startAt: '2030-03-13T10:15:00.000Z',
                      endAt: '2030-03-13T11:15:00.000Z',
                    },
                    updated_at: '2030-03-01T00:00:00.000Z',
                    created_at: '2030-03-01T00:00:00.000Z',
                  },
                  {
                    id: 'override-delete-b',
                    patch: null,
                    updated_at: '2030-02-28T00:00:00.000Z',
                    created_at: '2030-02-28T00:00:00.000Z',
                  },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          }),
        };
        return query;
      }),
    };
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService({
      reconcileNextReminderJobForSchedule: jest.fn(async () => ({ action: 'inserted' })),
    } as never);

    await expect(
      service.rescheduleScheduleSession('token-1', {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2030-03-13T10:00:00.000Z',
        startAt: '2030-03-13T11:00:00.000Z',
        endAt: '2030-03-13T12:00:00.000Z',
        timezone: 'America/New_York',
        reason: 'Teacher conflict',
        suppressNotifications: false,
      }),
    ).resolves.toEqual({ success: true, mode: 'recurring' });

    expect(operations).toEqual([
      { table: 'class_schedule_recurrence_exceptions', action: 'delete' },
      {
        table: 'class_schedule_recurrence_overrides',
        action: 'update',
        payload: expect.objectContaining({
          patch: {
            startAt: '2030-03-13T11:00:00.000Z',
            endAt: '2030-03-13T12:00:00.000Z',
            reason: 'Teacher conflict',
          },
          suppress_notifications: false,
          updated_by: 'profile-staff',
        }),
      },
      { table: 'class_schedule_recurrence_overrides', action: 'delete' },
    ]);
  });

  it('stores notification suppression on recurring cancellations', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const operations: Array<{ table: string; action: string; payload?: unknown }> = [];
    const mainClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          is: jest.fn(() => query),
          delete: jest.fn(() => query),
          insert: jest.fn((payload: unknown) => {
            operations.push({ table, action: 'insert', payload });
            return Promise.resolve({ data: null, error: null });
          }),
          update: jest.fn((payload: unknown) => {
            operations.push({ table, action: 'update', payload });
            return query;
          }),
          maybeSingle: jest.fn(async () => {
            if (table === 'class_schedule_recurrence') {
              return { data: { id: 'recurrence-1' }, error: null };
            }
            if (table === 'class_schedule_recurrence_exceptions') {
              return { data: null, error: null };
            }
            return { data: null, error: null };
          }),
        };
        return query;
      }),
    };
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService();
    await expect(
      service.cancelScheduleSession('token-1', {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-03-21T14:00:00.000Z',
        reason: 'Weather',
        suppressNotifications: true,
      }),
    ).resolves.toEqual({ success: true, mode: 'recurring' });

    expect(operations).toEqual([
      {
        table: 'class_schedule_recurrence_exceptions',
        action: 'insert',
        payload: expect.objectContaining({
          org_id: 'org-1',
          recurrence_id: 'recurrence-1',
          occurrence_key: '2026-03-21T14:00:00.000Z',
          reason: 'Weather',
          suppress_notifications: true,
          created_by: 'profile-staff',
          updated_by: 'profile-staff',
        }),
      },
    ]);
  });

  it('publishes a schedule-created activity when a new learning-space schedule is added', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const mainClient = makeReplaceSchedulesClient({
      previousSchedules: [],
      cascadeSchedules: [],
    });
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService();
    await service.replaceSchedulesForLearningSpace('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      createdBy: 'profile-staff',
      title: 'Algebra I',
      description: null,
      themeKey: null,
      participants: [
        {
          profileId: 'student-1',
          kind: 'child',
          displayName: 'Priya',
          avatarUrl: null,
          themeKey: null,
        },
      ],
      schedules: [
        {
          startAt: '2030-03-06T10:00:00.000Z',
          endAt: '2030-03-06T11:00:00.000Z',
          timezone: 'America/New_York',
          recurrence: null,
        },
      ],
    });

    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        eventType: 'class.schedule.created',
        actorProfileId: 'profile-staff',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        audienceRules: [{ kind: 'all_in_scope' }],
        payload: expect.objectContaining({
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
          title: 'Algebra I',
          startAt: '2030-03-06T10:00:00.000Z',
        }),
      }),
    );
  });

  it('publishes a schedule-ended activity when an end date is added to an existing recurrence', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const mainClient = makeReplaceSchedulesClient({
      previousSchedules: [
        {
          id: 'schedule-old',
          start_at: '2030-03-06T10:00:00.000Z',
          end_at: '2030-03-06T11:00:00.000Z',
          timezone: 'America/New_York',
          recurrence: [
            {
              frequency: 'weekly',
              interval: 1,
              count: null,
              until: null,
              timezone: 'America/New_York',
              byday: ['WE'],
            },
          ],
        },
      ],
      cascadeSchedules: [{ id: 'schedule-old' }],
      cascadeRecurrences: [{ id: 'recurrence-old' }],
    });
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService();
    await service.replaceSchedulesForLearningSpace('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      createdBy: 'profile-staff',
      title: 'Algebra I',
      description: null,
      themeKey: null,
      participants: [],
      schedules: [
        {
          startAt: '2030-03-06T10:00:00.000Z',
          endAt: '2030-03-06T11:00:00.000Z',
          timezone: 'America/New_York',
          recurrence: {
            frequency: 'weekly',
            interval: 1,
            count: null,
            until: '2030-05-01T00:00:00.000Z',
            timezone: 'America/New_York',
            rawRrule: null,
            bysecond: null,
            byminute: null,
            byhour: null,
            byday: ['WE'],
            bymonthday: null,
            byyearday: null,
            byweekno: null,
            bymonth: null,
            bysetpos: null,
            wkst: null,
            exceptions: [],
            overrides: [],
          },
        },
      ],
    });

    expect(publishActivityEventMock).toHaveBeenCalledTimes(1);
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'class.schedule.ended',
        payload: expect.objectContaining({
          recurrenceUntil: '2030-05-01T00:00:00.000Z',
          until: '2030-05-01T00:00:00.000Z',
        }),
      }),
    );
  });

  it('cancels active reminder jobs before deleting learning-space schedules', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const operations: Array<{ table: string; action: string; payload?: unknown }> = [];
    const mainClient = makeReplaceSchedulesClient({
      previousSchedules: [{ id: 'schedule-old' }],
      cascadeSchedules: [],
      operations,
    });
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService();
    await service.deleteSchedulesForLearningSpace('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    expect(operations).toEqual([
      {
        table: 'reminder_jobs',
        action: 'update',
        payload: expect.objectContaining({
          status: 'canceled',
          lease_owner: null,
          lease_until: null,
        }),
      },
      { table: 'class_schedule_participants', action: 'delete' },
      { table: 'class_schedules', action: 'delete' },
    ]);
  });

  it('soft-deletes learning-space schedules that have completion votes', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const operations: Array<{ table: string; action: string; payload?: unknown }> = [];
    const mainClient = makeReplaceSchedulesClient({
      previousSchedules: [{ id: 'schedule-with-votes' }, { id: 'schedule-free' }],
      cascadeSchedules: [],
      completionVoteRows: [{ schedule_id: 'schedule-with-votes' }],
      operations,
    });
    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'profile-staff',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'staff' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService();
    await service.deleteSchedulesForLearningSpace('token-1', {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    expect(operations).toEqual([
      {
        table: 'reminder_jobs',
        action: 'update',
        payload: expect.objectContaining({
          status: 'canceled',
          lease_owner: null,
          lease_until: null,
        }),
      },
      { table: 'class_schedule_participants', action: 'delete' },
      { table: 'class_schedules', action: 'delete' },
      {
        table: 'class_schedules',
        action: 'update',
        payload: expect.objectContaining({
          status: 'cancelled',
          deleted_by: 'profile-staff',
          updated_by: 'profile-staff',
        }),
      },
    ]);
  });

  it('scopes listed self-serve change requests to the active participant profile', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const requestInMock = jest.fn(() => requestQuery);
    const participantQuery = {
      select: jest.fn(() => participantQuery),
      eq: jest.fn(() => participantQuery),
      is: jest.fn(() => participantQuery),
      returns: jest.fn(async () => ({
        data: [{ schedule_id: 'schedule-allowed' }],
        error: null,
      })),
    };
    const requestQuery = {
      select: jest.fn(() => requestQuery),
      eq: jest.fn(() => requestQuery),
      is: jest.fn(() => requestQuery),
      order: jest.fn(() => requestQuery),
      in: requestInMock,
      returns: jest.fn(async () => ({
        data: [
          {
            id: 'request-1',
            org_id: 'org-1',
            schedule_id: 'schedule-allowed',
            occurrence_key: null,
            learning_space_id: 'space-1',
            channel_id: 'channel-1',
            request_type: 'cancel',
            status: 'pending',
            requested_by_profile_id: 'guardian-1',
            requested_by_role: 'guardian',
            requested_note: 'Sick',
            current_start_at: '2030-03-06T10:00:00.000Z',
            current_end_at: '2030-03-06T11:00:00.000Z',
            requested_start_at: null,
            requested_end_at: null,
            requested_timezone: null,
            approval_required_from: 'educator',
            decided_by_profile_id: null,
            decision_note: null,
            decided_at: null,
            applied_at: null,
            created_at: '2030-03-01T00:00:00.000Z',
          },
        ],
        error: null,
      })),
    };
    const mainClient = {
      from: jest.fn((table: string) =>
        table === 'class_schedule_participants' ? participantQuery : requestQuery,
      ),
    };

    createSupabaseServiceClientMock
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-1',
          active_profile_id: 'guardian-1',
        }) as never,
      )
      .mockReturnValueOnce(makeSingleResult([{ role_key: 'guardian' }]) as never)
      .mockReturnValueOnce(mainClient as never);

    const service = new SchedulesService();
    await expect(
      service.listSessionChangeRequests('token-1', { orgId: 'org-1' }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'request-1',
        scheduleId: 'schedule-allowed',
        requestedTimezone: null,
      }),
    ]);

    expect(requestInMock).toHaveBeenCalledWith('schedule_id', ['schedule-allowed']);
  });

  it('preserves requested timezone when approving a pending reschedule', async () => {
    createSupabaseSessionClientMock.mockReturnValue({
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: { id: 'auth-user-1' } },
          error: null,
        })),
      },
    } as never);

    const updates: Array<{ table: string; payload: unknown }> = [];
    const requestRow = {
      id: 'request-1',
      org_id: 'org-1',
      schedule_id: 'schedule-1',
      occurrence_key: null,
      learning_space_id: 'space-1',
      channel_id: 'channel-1',
      request_type: 'reschedule',
      status: 'pending',
      requested_by_profile_id: 'guardian-1',
      requested_by_role: 'guardian',
      requested_note: 'Can we move this?',
      current_start_at: '2030-03-06T10:00:00.000Z',
      current_end_at: '2030-03-06T11:00:00.000Z',
      requested_start_at: '2030-03-06T12:00:00.000Z',
      requested_end_at: '2030-03-06T13:00:00.000Z',
      requested_timezone: 'America/New_York',
      approval_required_from: 'educator',
      decided_by_profile_id: null,
      decision_note: null,
      decided_at: null,
      applied_at: null,
      created_at: '2030-03-01T00:00:00.000Z',
    };
    const mainClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          is: jest.fn(() => query),
          update: jest.fn((payload: unknown) => {
            updates.push({ table, payload });
            return query;
          }),
          maybeSingle: jest.fn(async () => {
            if (table === 'class_session_change_requests') {
              return { data: requestRow, error: null };
            }
            if (table === 'class_schedules') {
              return {
                data: {
                  id: 'schedule-1',
                  title: 'Algebra I',
                  start_at: '2030-03-06T10:00:00.000Z',
                  end_at: '2030-03-06T11:00:00.000Z',
                  timezone: 'America/New_York',
                  source_learning_space_id: 'space-1',
                  source_channel_id: 'channel-1',
                  participants: [],
                },
                error: null,
              };
            }
            if (table === 'class_schedule_recurrence') {
              return { data: null, error: null };
            }
            return { data: null, error: null };
          }),
          single: jest.fn(async () => ({
            data: {
              ...requestRow,
              status: 'applied',
              decision_note: 'Approved',
              decided_by_profile_id: 'educator-1',
              decided_at: '2030-03-01T01:00:00.000Z',
              applied_at: '2030-03-01T01:00:00.000Z',
            },
            error: null,
          })),
        };
        return query;
      }),
    };
    const participantClient = {
      from: jest.fn((table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          is: jest.fn(() => query),
          maybeSingle: jest.fn(async () => ({
            data:
              table === 'class_schedule_participants'
                ? { role: 'educator', display_name: 'Ms. Chen' }
                : null,
            error: null,
          })),
          returns: jest.fn(async () => ({
            data: table === 'user_roles' ? [{ role_key: 'educator' }] : [],
            error: null,
          })),
        };
        return query;
      }),
    };

    createSupabaseServiceClientMock
      .mockReturnValueOnce(mainClient as never)
      .mockReturnValueOnce(
        makeSingleResult({
          id: 'account-educator',
          active_profile_id: 'educator-1',
        }) as never,
      )
      .mockReturnValueOnce(participantClient as never);

    const service = new SchedulesService();
    await expect(
      service.approveSessionChangeRequest('token-1', 'request-1', {
        note: 'Approved',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'applied',
        request: expect.objectContaining({
          requestedTimezone: 'America/New_York',
        }),
      }),
    );

    expect(updates).toContainEqual({
      table: 'class_schedules',
      payload: expect.objectContaining({
        timezone: 'America/New_York',
      }),
    });
  });
});

function makeReplaceSchedulesClient(input: {
  previousSchedules: unknown[];
  cascadeSchedules: unknown[];
  cascadeRecurrences?: unknown[];
  completionVoteRows?: unknown[];
  operations?: Array<{ table: string; action: string; payload?: unknown }>;
}) {
  let classSchedulesSelectCount = 0;
  return {
    from: jest.fn((table: string) => {
      const query = {
        select: jest.fn(() => {
          classSchedulesSelectCount += table === 'class_schedules' ? 1 : 0;
          return query;
        }),
        eq: jest.fn(() => query),
        is: jest.fn(() => query),
        in: jest.fn(() => query),
        not: jest.fn(() => query),
        delete: jest.fn(() => {
          input.operations?.push({ table, action: 'delete' });
          return query;
        }),
        insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
        update: jest.fn((payload: unknown) => {
          input.operations?.push({ table, action: 'update', payload });
          return query;
        }),
        returns: jest.fn(async () => {
          if (table === 'class_schedules') {
            return {
              data:
                classSchedulesSelectCount === 1
                  ? input.previousSchedules
                  : input.cascadeSchedules,
              error: null,
            };
          }
          if (table === 'class_schedule_recurrence') {
            return { data: input.cascadeRecurrences ?? [], error: null };
          }
          if (table === 'class_session_completion_votes') {
            return { data: input.completionVoteRows ?? [], error: null };
          }
          return { data: [], error: null };
        }),
      };
      return query;
    }),
  };
}
