import { ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

describe('SchedulesService authorization', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);

  function makeSingleResult<T>(result: T) {
    const chain = {
      from: jest.fn(() => chain),
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      is: jest.fn(() => chain),
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
      .mockReturnValueOnce(makeSingleResult({ id: 'account-1' }) as never)
      .mockReturnValueOnce(
        makeSingleResult(roleKeys.map((role_key) => ({ role_key }))) as never,
      );

    const service = new SchedulesService();
    await (
      service as unknown as {
        requireOrgActor(accessToken: string, orgId: string): Promise<void>;
      }
    ).requireOrgActor('token-1', 'org-1');
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['owner', 'admin', 'staff'])(
    'allows %s to manage learning-space schedules',
    async (roleKey) => {
      await expect(requireOrgActorWithRoles([roleKey])).resolves.toBeUndefined();
    },
  );

  it('rejects non-manager org members', async () => {
    await expect(requireOrgActorWithRoles(['guardian'])).rejects.toThrow(
      ForbiddenException,
    );
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
            if (table === 'class_schedule_recurrence_overrides') {
              return { data: null, error: null };
            }
            return { data: null, error: null };
          }),
        };
        return query;
      }),
    };
    createSupabaseServiceClientMock
      .mockReturnValueOnce(makeSingleResult({ id: 'account-1' }) as never)
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
        }),
      },
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
      .mockReturnValueOnce(makeSingleResult({ id: 'account-1' }) as never)
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
        }),
      },
    ]);
  });
});
