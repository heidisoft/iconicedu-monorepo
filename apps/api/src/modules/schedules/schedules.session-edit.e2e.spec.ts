/**
 * HTTP-level end-to-end coverage for the single-session edit flow used by
 * apps/web's update/split/cancel class-schedule-session server actions:
 *
 *   GET  /schedules/session/context   (bootstrap: not-found + archived fast-fail)
 *   POST /schedules/session/reschedule
 *   POST /schedules/session/split
 *   POST /schedules/session/cancel
 *
 * A real Nest HTTP server is started on an ephemeral port, and requests go through
 * the real AuthGuard, routing, DTO parsing, `requireOrgActor` role checks, and
 * SchedulesService. Only the Supabase clients are replaced, with an in-memory
 * database that records every write — so each test can assert not just the
 * response, but that a rejected request changed nothing.
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { AuthService } from '@iconicedu/api/modules/auth/auth.service';
import { SchedulesController } from '@iconicedu/api/modules/schedules/schedules.controller';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

// ─── In-memory Supabase ──────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Write = {
  table: string;
  op: 'update' | 'insert' | 'upsert' | 'delete';
  payload?: unknown;
};

const mockDb: {
  tables: Record<string, Row[]>;
  writes: Write[];
  usersByToken: Map<string, string>;
} = {
  tables: {},
  writes: [],
  usersByToken: new Map(),
};

function mockCreateQuery(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let op: Write['op'] | 'select' = 'select';
  let payload: unknown;
  let selectColumns = '';

  const rows = () => (mockDb.tables[table] ??= []);
  const matching = () => rows().filter((row) => filters.every((filter) => filter(row)));

  // Supports the `participants:class_schedule_participants(...)` embed used by
  // loadRescheduleActivityContext.
  const project = (row: Row): Row =>
    table === 'class_schedules' && selectColumns.includes('participants:')
      ? {
          ...row,
          participants: (mockDb.tables.class_schedule_participants ?? []).filter(
            (participant) => participant.schedule_id === row.id,
          ),
        }
      : row;

  const execute = () => {
    if (op === 'select') return { data: matching().map(project), error: null };
    mockDb.writes.push({ table, op, payload });
    if (op === 'update') {
      for (const row of matching()) Object.assign(row, payload as Row);
    } else if (op === 'delete') {
      mockDb.tables[table] = rows().filter(
        (row) => !filters.every((filter) => filter(row)),
      );
    } else {
      const incoming = Array.isArray(payload) ? payload : [payload];
      rows().push(...(incoming as Row[]));
    }
    return { data: null, error: null };
  };

  const query = {
    select(columns = '*') {
      selectColumns = columns;
      return query;
    },
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return query;
    },
    neq(column: string, value: unknown) {
      filters.push((row) => row[column] !== value);
      return query;
    },
    is(column: string, value: unknown) {
      filters.push((row) => (row[column] ?? null) === value);
      return query;
    },
    in(column: string, values: unknown[]) {
      filters.push((row) => values.includes(row[column]));
      return query;
    },
    gte: () => query,
    lte: () => query,
    gt: () => query,
    lt: () => query,
    order: () => query,
    limit: () => query,
    update(patch: unknown) {
      op = 'update';
      payload = patch;
      return query;
    },
    insert(value: unknown) {
      op = 'insert';
      payload = value;
      return query;
    },
    upsert(value: unknown) {
      op = 'upsert';
      payload = value;
      return query;
    },
    delete() {
      op = 'delete';
      return query;
    },
    returns: () => query,
    async maybeSingle() {
      const result = execute();
      return {
        data: Array.isArray(result.data) ? (result.data[0] ?? null) : null,
        error: null,
      };
    },
    async single() {
      const result = execute();
      return { data: Array.isArray(result.data) ? result.data[0] : null, error: null };
    },
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(execute()).then(resolve, reject);
    },
  };
  return query;
}

const mockServiceClient = { from: (table: string) => mockCreateQuery(table) };

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => mockServiceClient,
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: (token: string) => ({
    from: (table: string) => mockCreateQuery(table),
    auth: {
      getUser: async () => {
        const userId = mockDb.usersByToken.get(token);
        return userId
          ? { data: { user: { id: userId } }, error: null }
          : { data: { user: null }, error: { message: 'invalid JWT' } };
      },
    },
  }),
}));

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(async () => null),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ORG = 'org-1';
const ACTIVE_SPACE = 'space-active';
const ARCHIVED_SPACE = 'space-archived';
const STATUS_ARCHIVED_SPACE = 'space-status-archived';

function token(sub: string) {
  const value = jwt.sign({ sub }, 'test-secret');
  mockDb.usersByToken.set(value, sub);
  return value;
}

function schedule(id: string, learningSpaceId: string | null, extra: Row = {}): Row {
  return {
    id,
    org_id: ORG,
    title: `Class ${id}`,
    start_at: '2026-12-01T15:00:00.000Z',
    end_at: '2026-12-01T16:00:00.000Z',
    timezone: 'America/New_York',
    status: 'scheduled',
    source_learning_space_id: learningSpaceId,
    source_channel_id: learningSpaceId ? `channel-${learningSpaceId}` : null,
    deleted_at: null,
    ...extra,
  };
}

function seed() {
  mockDb.writes = [];
  mockDb.usersByToken.clear();
  mockDb.tables = {
    accounts: [
      {
        id: 'acct-staff',
        auth_user_id: 'user-staff',
        org_id: ORG,
        active_profile_id: 'profile-staff',
        deleted_at: null,
      },
      {
        id: 'acct-guardian',
        auth_user_id: 'user-guardian',
        org_id: ORG,
        active_profile_id: 'profile-guardian',
        deleted_at: null,
      },
    ],
    user_roles: [
      { account_id: 'acct-staff', org_id: ORG, role_key: 'staff', deleted_at: null },
      {
        account_id: 'acct-guardian',
        org_id: ORG,
        role_key: 'guardian',
        deleted_at: null,
      },
    ],
    learning_spaces: [
      {
        id: ACTIVE_SPACE,
        org_id: ORG,
        status: 'active',
        archived_at: null,
        deleted_at: null,
      },
      {
        id: ARCHIVED_SPACE,
        org_id: ORG,
        status: 'active',
        archived_at: '2026-11-01T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: STATUS_ARCHIVED_SPACE,
        org_id: ORG,
        status: 'archived',
        archived_at: null,
        deleted_at: null,
      },
    ],
    class_schedules: [
      schedule('sched-active', ACTIVE_SPACE),
      schedule('sched-archived', ARCHIVED_SPACE),
      schedule('sched-status-archived', STATUS_ARCHIVED_SPACE),
      schedule('sched-recurring-archived', ARCHIVED_SPACE),
      schedule('sched-manual', null),
      schedule('sched-deleted', ACTIVE_SPACE, { deleted_at: '2026-10-01T00:00:00.000Z' }),
    ],
    class_schedule_participants: [
      {
        schedule_id: 'sched-active',
        profile_id: 'profile-student',
        role: 'student',
        display_name: 'Sam',
        avatar_url: null,
        theme_key: null,
      },
    ],
    class_schedule_recurrence: [
      {
        id: 'rec-archived',
        org_id: ORG,
        schedule_id: 'sched-recurring-archived',
        frequency: 'weekly',
        timezone: 'America/New_York',
        until: null,
        count: null,
        byday: ['TU'],
        deleted_at: null,
      },
    ],
    class_schedule_recurrence_exceptions: [],
    class_schedule_recurrence_overrides: [],
  };
}

// ─── App ─────────────────────────────────────────────────────────────────────

describe('Session edit flow (HTTP e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const reconcileNextReminderJobForSchedule = jest.fn(async () => undefined);

  beforeAll(async () => {
    // Production builds use tsc with emitDecoratorMetadata; jest uses Babel (and a
    // TS transpile for controllers) without it. Declare the same constructor
    // metadata tsc would emit so Nest resolves the real dependency graph.
    Reflect.defineMetadata('design:paramtypes', [SchedulesService], SchedulesController);
    Reflect.defineMetadata('design:paramtypes', [AuthService], AuthGuard);
    Reflect.defineMetadata(
      'design:paramtypes',
      [ReminderReconcileService],
      SchedulesService,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [
        AuthService,
        AuthGuard,
        SchedulesService,
        {
          provide: ReminderReconcileService,
          useValue: { reconcileNextReminderJobForSchedule },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    // Mirror main.ts so request handling matches production.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    seed();
    reconcileNextReminderJobForSchedule.mockClear();
    jest.mocked(publishActivityEvent).mockClear();
  });

  async function call(
    method: 'GET' | 'POST',
    path: string,
    {
      auth,
      query,
      body,
    }: { auth?: string; query?: Record<string, string>; body?: unknown } = {},
  ) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {}))
      url.searchParams.set(key, value);
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  const staff = () => token('user-staff');
  const scheduleWrites = () =>
    mockDb.writes.filter((write) => write.table.startsWith('class_schedule'));

  // ─── GET /schedules/session/context ────────────────────────────────────────

  describe('GET /schedules/session/context', () => {
    it('returns the edit context for a session in an active classroom', async () => {
      const res = await call('GET', '/schedules/session/context', {
        auth: staff(),
        query: { orgId: ORG, scheduleId: 'sched-active' },
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        scheduleId: 'sched-active',
        title: 'Class sched-active',
        startAt: '2026-12-01T15:00:00.000Z',
        endAt: '2026-12-01T16:00:00.000Z',
        timezone: 'America/New_York',
        sourceLearningSpaceId: ACTIVE_SPACE,
        sourceChannelId: `channel-${ACTIVE_SPACE}`,
      });
      expect(mockDb.writes).toEqual([]);
    });

    it('returns a null learning space for a manual (non-classroom) schedule', async () => {
      const res = await call('GET', '/schedules/session/context', {
        auth: staff(),
        query: { orgId: ORG, scheduleId: 'sched-manual' },
      });

      expect(res.status).toBe(200);
      expect(res.body.sourceLearningSpaceId).toBeNull();
    });

    it.each([
      ['archived_at set', 'sched-archived'],
      ["status = 'archived'", 'sched-status-archived'],
    ])(
      'rejects a session whose classroom is archived (%s)',
      async (_label, scheduleId) => {
        const res = await call('GET', '/schedules/session/context', {
          auth: staff(),
          query: { orgId: ORG, scheduleId },
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Archived classrooms cannot be changed.');
      },
    );

    it.each([
      ['unknown id', 'sched-missing'],
      ['soft-deleted schedule', 'sched-deleted'],
    ])('rejects a schedule that does not exist (%s)', async (_label, scheduleId) => {
      const res = await call('GET', '/schedules/session/context', {
        auth: staff(),
        query: { orgId: ORG, scheduleId },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Schedule not found');
    });

    it('does not leak schedules across orgs', async () => {
      mockDb.tables.accounts.push({
        id: 'acct-other',
        auth_user_id: 'user-staff',
        org_id: 'org-2',
        active_profile_id: 'p',
        deleted_at: null,
      });
      mockDb.tables.user_roles.push({
        account_id: 'acct-other',
        org_id: 'org-2',
        role_key: 'staff',
        deleted_at: null,
      });

      const res = await call('GET', '/schedules/session/context', {
        auth: staff(),
        query: { orgId: 'org-2', scheduleId: 'sched-active' },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Schedule not found');
    });

    it('rejects requests without a bearer token (AuthGuard)', async () => {
      const res = await call('GET', '/schedules/session/context', {
        query: { orgId: ORG, scheduleId: 'sched-active' },
      });
      expect(res.status).toBe(401);
    });

    it('rejects a token Supabase does not recognise', async () => {
      const forged = jwt.sign({ sub: 'user-staff' }, 'attacker-secret');
      const res = await call('GET', '/schedules/session/context', {
        auth: forged,
        query: { orgId: ORG, scheduleId: 'sched-active' },
      });
      expect(res.status).toBe(401);
    });

    it('rejects org members without a staff/admin/owner role', async () => {
      const res = await call('GET', '/schedules/session/context', {
        auth: token('user-guardian'),
        query: { orgId: ORG, scheduleId: 'sched-active' },
      });
      expect(res.status).toBe(403);
    });

    it('rejects users who are not members of the org', async () => {
      const res = await call('GET', '/schedules/session/context', {
        auth: token('user-stranger'),
        query: { orgId: ORG, scheduleId: 'sched-active' },
      });
      expect(res.status).toBe(403);
    });

    it.each([
      ['orgId', { scheduleId: 'sched-active' }],
      ['scheduleId', { orgId: ORG }],
    ])('requires %s', async (param, query) => {
      const res = await call('GET', '/schedules/session/context', {
        auth: staff(),
        query,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(`${param} is required`);
    });
  });

  // ─── Mutations: archived gate is enforced server-side ──────────────────────

  describe('archived classrooms are read-only for every mutation', () => {
    const rescheduleBody = (scheduleId: string) => ({
      orgId: ORG,
      scheduleId,
      occurrenceKey: null,
      startAt: '2026-12-02T15:00:00.000Z',
      endAt: '2026-12-02T16:00:00.000Z',
      timezone: 'America/New_York',
      reason: null,
      suppressNotifications: false,
    });

    it('POST /schedules/session/reschedule rejects and writes nothing', async () => {
      const res = await call('POST', '/schedules/session/reschedule', {
        auth: staff(),
        body: rescheduleBody('sched-archived'),
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Archived classrooms cannot be changed.');
      expect(scheduleWrites()).toEqual([]);
      expect(publishActivityEvent).not.toHaveBeenCalled();
      expect(reconcileNextReminderJobForSchedule).not.toHaveBeenCalled();
      expect(
        mockDb.tables.class_schedules.find((row) => row.id === 'sched-archived')
          ?.start_at,
      ).toBe('2026-12-01T15:00:00.000Z');
    });

    it("POST /schedules/session/reschedule (scope 'all') rejects and writes nothing", async () => {
      const res = await call('POST', '/schedules/session/reschedule', {
        auth: staff(),
        body: {
          ...rescheduleBody('sched-recurring-archived'),
          occurrenceKey: '2026-12-01T15:00:00.000Z',
          scope: 'all',
          byWeekday: ['WE'],
          confirmDropFutureOverrides: true,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Archived classrooms cannot be changed.');
      expect(scheduleWrites()).toEqual([]);
    });

    it('POST /schedules/session/split rejects and writes nothing', async () => {
      const res = await call('POST', '/schedules/session/split', {
        auth: staff(),
        body: {
          orgId: ORG,
          scheduleId: 'sched-recurring-archived',
          occurrenceKey: '2026-12-08T15:00:00.000Z',
          newStartAt: '2026-12-09T15:00:00.000Z',
          newEndAt: '2026-12-09T16:00:00.000Z',
          timezone: 'America/New_York',
          byWeekday: ['WE'],
          reason: null,
          suppressNotifications: false,
          confirmDropFutureOverrides: true,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Archived classrooms cannot be changed.');
      expect(scheduleWrites()).toEqual([]);
      expect(publishActivityEvent).not.toHaveBeenCalled();
    });

    it('POST /schedules/session/cancel rejects and writes nothing', async () => {
      const res = await call('POST', '/schedules/session/cancel', {
        auth: staff(),
        body: {
          orgId: ORG,
          scheduleId: 'sched-status-archived',
          occurrenceKey: null,
          reason: null,
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Archived classrooms cannot be changed.');
      expect(scheduleWrites()).toEqual([]);
      expect(
        mockDb.tables.class_schedules.find((row) => row.id === 'sched-status-archived')
          ?.status,
      ).toBe('scheduled');
    });
  });

  // ─── Mutations: happy paths still work ─────────────────────────────────────

  describe('active classrooms keep working', () => {
    it('reschedules a single session, publishes activity, and reconciles reminders', async () => {
      const res = await call('POST', '/schedules/session/reschedule', {
        auth: staff(),
        body: {
          orgId: ORG,
          scheduleId: 'sched-active',
          occurrenceKey: null,
          startAt: '2026-12-02T15:00:00.000Z',
          endAt: '2026-12-02T16:00:00.000Z',
          timezone: 'America/New_York',
          reason: 'Teacher out',
          suppressNotifications: false,
        },
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true, mode: 'single' });
      expect(
        mockDb.tables.class_schedules.find((row) => row.id === 'sched-active'),
      ).toMatchObject({
        start_at: '2026-12-02T15:00:00.000Z',
        end_at: '2026-12-02T16:00:00.000Z',
        updated_by: 'profile-staff',
      });
      expect(publishActivityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'class.session.rescheduled',
          actorProfileId: 'profile-staff',
          payload: expect.objectContaining({
            scheduleId: 'sched-active',
            rescheduledFromStartAt: '2026-12-01T15:00:00.000Z',
            rescheduledToStartAt: '2026-12-02T15:00:00.000Z',
            reason: 'Teacher out',
            members: [expect.objectContaining({ profileId: 'profile-student' })],
          }),
        }),
      );
      expect(reconcileNextReminderJobForSchedule).toHaveBeenCalledWith({
        orgId: ORG,
        scheduleId: 'sched-active',
      });
    });

    it('cancels a single session in an active classroom', async () => {
      const res = await call('POST', '/schedules/session/cancel', {
        auth: staff(),
        body: {
          orgId: ORG,
          scheduleId: 'sched-active',
          occurrenceKey: null,
          reason: null,
        },
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true, mode: 'single' });
      expect(
        mockDb.tables.class_schedules.find((row) => row.id === 'sched-active')?.status,
      ).toBe('cancelled');
    });

    it('still lets staff cancel a manual schedule with no classroom', async () => {
      const res = await call('POST', '/schedules/session/cancel', {
        auth: staff(),
        body: {
          orgId: ORG,
          scheduleId: 'sched-manual',
          occurrenceKey: null,
          reason: null,
        },
      });

      expect(res.status).toBe(201);
      expect(
        mockDb.tables.class_schedules.find((row) => row.id === 'sched-manual')?.status,
      ).toBe('cancelled');
    });

    it('rejects rescheduling a schedule that does not exist instead of silently no-oping', async () => {
      const res = await call('POST', '/schedules/session/reschedule', {
        auth: staff(),
        body: {
          orgId: ORG,
          scheduleId: 'sched-missing',
          occurrenceKey: null,
          startAt: '2026-12-02T15:00:00.000Z',
          endAt: '2026-12-02T16:00:00.000Z',
          timezone: 'America/New_York',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Schedule not found');
      expect(scheduleWrites()).toEqual([]);
    });

    it('rejects mutations from non-staff before touching any data', async () => {
      const res = await call('POST', '/schedules/session/cancel', {
        auth: token('user-guardian'),
        body: { orgId: ORG, scheduleId: 'sched-active', occurrenceKey: null },
      });

      expect(res.status).toBe(403);
      expect(mockDb.writes).toEqual([]);
    });
  });
});
