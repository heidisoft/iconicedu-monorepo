import { BadRequestException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';
import {
  MAX_CALENDAR_SCHEDULE_IDS,
  SchedulesController,
} from '@iconicedu/api/modules/schedules/schedules.controller';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

// Deliberately NOT mocking @iconicedu/live-sessions-core: these tests run the
// real shared builder so the endpoint's output is pinned end to end.

type Call = { table: string; method: string; args: unknown[] };

function createFakeSessionClient(tables: Record<string, unknown[]>) {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        const result = { data: tables[table] ?? [], error: null };
        const builder: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'in', 'is', 'order', 'returns']) {
          builder[method] = (...args: unknown[]) => {
            calls.push({ table, method, args });
            return builder;
          };
        }
        builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
        return builder;
      },
    },
  };
}

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'schedule-1',
    org_id: 'org-1',
    title: 'Algebra I',
    description: null,
    location: null,
    meeting_link: null,
    start_at: '2026-09-02T09:00:00.000Z',
    end_at: '2026-09-02T10:00:00.000Z',
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
    created_at: '2026-08-01T00:00:00.000Z',
    created_by: 'user-1',
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  };
}

describe('SchedulesService.listForCalendar', () => {
  const sessionClientMock = jest.mocked(createSupabaseSessionClient);
  const serviceClientMock = jest.mocked(createSupabaseServiceClient);

  beforeEach(() => {
    sessionClientMock.mockReset();
    serviceClientMock.mockReset();
  });

  it('reads through the caller RLS session client, never the service-role client', async () => {
    const fake = createFakeSessionClient({ class_schedules: [scheduleRow()] });
    sessionClientMock.mockReturnValue(fake.client as never);

    await new SchedulesService().listForCalendar('token-1', { orgId: 'org-1' });

    expect(sessionClientMock).toHaveBeenCalledWith('token-1');
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it('returns mapped ClassScheduleVMs for every source kind, scoped to the org', async () => {
    const fake = createFakeSessionClient({
      class_schedules: [
        scheduleRow(),
        scheduleRow({
          id: 'block-1',
          source_kind: 'availability_block',
          source_learning_space_id: null,
          source_channel_id: null,
          source_owner_user_id: 'user-9',
        }),
        scheduleRow({
          id: 'manual-1',
          source_kind: 'manual',
          source_learning_space_id: null,
          source_channel_id: null,
        }),
      ],
      learning_spaces: [{ id: 'space-1', status: 'active', archived_at: null }],
    });
    sessionClientMock.mockReturnValue(fake.client as never);

    const result = await new SchedulesService().listForCalendar('token-1', {
      orgId: 'org-1',
    });

    expect(result.map((schedule) => [schedule.ids.id, schedule.source.kind])).toEqual([
      ['schedule-1', 'class_session'],
      ['block-1', 'availability_block'],
      ['manual-1', 'manual'],
    ]);
    expect(result[0].source).toMatchObject({
      kind: 'class_session',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
      learningSpaceStatus: 'active',
      archivedAt: null,
    });

    const scheduleCalls = fake.calls.filter((call) => call.table === 'class_schedules');
    expect(scheduleCalls).toEqual(
      expect.arrayContaining([
        { table: 'class_schedules', method: 'eq', args: ['org_id', 'org-1'] },
        { table: 'class_schedules', method: 'is', args: ['deleted_at', null] },
      ]),
    );
    // No source_kind filter: unlike GET /schedules, the calendar is not class_session-only.
    expect(scheduleCalls).not.toContainEqual(
      expect.objectContaining({ method: 'eq', args: ['source_kind', expect.anything()] }),
    );
  });

  it('filters by scheduleIds when given', async () => {
    const fake = createFakeSessionClient({ class_schedules: [scheduleRow()] });
    sessionClientMock.mockReturnValue(fake.client as never);

    await new SchedulesService().listForCalendar('token-1', {
      orgId: 'org-1',
      scheduleIds: ['schedule-1'],
    });

    expect(fake.calls).toContainEqual({
      table: 'class_schedules',
      method: 'in',
      args: ['id', ['schedule-1']],
    });
  });

  it('short-circuits an empty scheduleIds list without touching Supabase', async () => {
    await expect(
      new SchedulesService().listForCalendar('token-1', {
        orgId: 'org-1',
        scheduleIds: [],
      }),
    ).resolves.toEqual([]);
    expect(sessionClientMock).not.toHaveBeenCalled();
  });
});

describe('SchedulesController.listForCalendar', () => {
  function makeController() {
    const listForCalendar = jest.fn(async () => []);
    const controller = new SchedulesController({ listForCalendar } as never);
    return { controller, listForCalendar };
  }

  const req = { headers: { authorization: 'Bearer token-1' } } as never;

  it.each([[undefined], [''], [['org-1', 'org-2']]])(
    'rejects a missing or malformed orgId (%p) without calling the service',
    (orgId) => {
      const { controller, listForCalendar } = makeController();
      expect(() => controller.listForCalendar(req, orgId as never)).toThrow(
        new BadRequestException('orgId is required'),
      );
      expect(listForCalendar).not.toHaveBeenCalled();
    },
  );

  it('forwards the bearer token and orgId with no id filter by default', async () => {
    const { controller, listForCalendar } = makeController();
    await controller.listForCalendar(req, 'org-1');
    expect(listForCalendar).toHaveBeenCalledWith('token-1', {
      orgId: 'org-1',
      scheduleIds: undefined,
    });
  });

  it('parses, trims, and de-duplicates comma-separated scheduleIds', async () => {
    const { controller, listForCalendar } = makeController();
    await controller.listForCalendar(req, 'org-1', ' a, b ,,a ');
    expect(listForCalendar).toHaveBeenCalledWith('token-1', {
      orgId: 'org-1',
      scheduleIds: ['a', 'b'],
    });
  });

  it('treats an empty scheduleIds param as an empty filter, not "all schedules"', async () => {
    const { controller, listForCalendar } = makeController();
    await controller.listForCalendar(req, 'org-1', '');
    expect(listForCalendar).toHaveBeenCalledWith('token-1', {
      orgId: 'org-1',
      scheduleIds: [],
    });
  });

  it('rejects array-valued scheduleIds (e.g. ?scheduleIds=a&scheduleIds=b)', () => {
    const { controller, listForCalendar } = makeController();
    expect(() => controller.listForCalendar(req, 'org-1', ['a', 'b'] as never)).toThrow(
      BadRequestException,
    );
    expect(listForCalendar).not.toHaveBeenCalled();
  });

  it(`rejects more than ${MAX_CALENDAR_SCHEDULE_IDS} scheduleIds`, () => {
    const { controller, listForCalendar } = makeController();
    const tooMany = Array.from(
      { length: MAX_CALENDAR_SCHEDULE_IDS + 1 },
      (_, i) => `id-${i}`,
    ).join(',');
    expect(() => controller.listForCalendar(req, 'org-1', tooMany)).toThrow(
      BadRequestException,
    );
    expect(listForCalendar).not.toHaveBeenCalled();
  });
});
