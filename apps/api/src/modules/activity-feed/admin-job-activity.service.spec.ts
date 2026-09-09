import { ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { AdminJobActivityService } from '@iconicedu/api/modules/activity-feed/admin-job-activity.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

function makeSingleQuery<T>(row: T | null) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data: row, error: null })),
  };
  return query;
}

/**
 * Returns `rows`, but honours the `.eq(column, value)` filters the service
 * applies so a single mocked table can serve several job kinds.
 */
function makeFilteredQuery<T extends Record<string, unknown>>(rows: T[]) {
  const filters: Array<[string, unknown]> = [];
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    }),
    is: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    returns: jest.fn(async () => ({
      // Enforce only the filters whose column exists on the fixture rows
      // (the discriminator job_kind / job_type); ignore org_id, deleted_at, etc.
      data: rows.filter((row) =>
        filters.every(([column, value]) => !(column in row) || row[column] === value),
      ),
      error: null,
    })),
  };
  return query;
}

function makeErrorQuery(message: string) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    returns: jest.fn(async () => ({ data: null, error: { message } })),
  };
  return query;
}

function mockClient(handlers: Record<string, () => unknown>) {
  const from = jest.fn((table: string) => {
    const handler = handlers[table];
    if (!handler) throw new Error(`Unexpected table ${table}`);
    return handler();
  });
  createSupabaseServiceClientMock.mockReturnValue({ from } as never);
  return from;
}

const ADMIN_ACCOUNT = () => makeSingleQuery({ id: 'account-1' });
const ADMIN_ROLES = () => makeFilteredQuery([{ role_key: 'admin' }]);

const PIPELINE_ROWS = [
  {
    id: 'g1',
    job_kind: 'activity.generate',
    status: 'succeeded',
    source_kind: 'message',
    dedupe_key: 'dedupe-1',
    attempt_count: 1,
    max_attempts: 8,
    run_at: '2026-09-09T10:00:00.000Z',
    dispatched_at: '2026-09-09T10:01:00.000Z',
    created_at: '2026-09-09T09:59:00.000Z',
    updated_at: '2026-09-09T10:01:00.000Z',
  },
  {
    id: 'g2',
    job_kind: 'activity.generate',
    status: 'failed',
    source_kind: 'reaction',
    dedupe_key: 'dedupe-2',
    attempt_count: 3,
    max_attempts: 8,
    last_error: 'boom',
    run_at: '2026-09-09T11:00:00.000Z',
    dispatched_at: '2026-09-09T11:05:00.000Z',
    created_at: '2026-09-09T10:59:00.000Z',
    updated_at: '2026-09-09T11:05:00.000Z',
  },
  {
    id: 'd1',
    job_kind: 'notification.deliver',
    status: 'succeeded',
    dedupe_key: 'push-1',
    attempt_count: 1,
    max_attempts: 8,
    created_at: '2026-09-09T12:00:00.000Z',
    updated_at: '2026-09-09T12:00:00.000Z',
  },
];

const REMINDER_ROWS = [
  {
    id: 'r1',
    job_type: 'session.reminder',
    status: 'pending',
    target_kind: 'channel',
    occurrence_start_at: '2026-09-10T09:00:00.000Z',
    dedupe_key: 'reminder-1',
    attempt_count: 0,
    max_attempts: 8,
    created_at: '2026-09-09T08:00:00.000Z',
    updated_at: '2026-09-09T08:00:00.000Z',
  },
];

describe('AdminJobActivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects callers without an admin role', async () => {
    mockClient({
      accounts: () => makeSingleQuery({ id: 'account-1' }),
      user_roles: () => makeFilteredQuery([{ role_key: 'member' }]),
    });

    const service = new AdminJobActivityService();

    await expect(service.fetchJobActivity('auth-1', 'org-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns a group per job kind across the pipeline and reminder queues', async () => {
    mockClient({
      accounts: ADMIN_ACCOUNT,
      user_roles: ADMIN_ROLES,
      event_pipeline_jobs: () => makeFilteredQuery(PIPELINE_ROWS),
      reminder_jobs: () => makeFilteredQuery(REMINDER_ROWS),
    });

    const service = new AdminJobActivityService();
    const overview = await service.fetchJobActivity('auth-1', 'org-1');

    expect(overview.groups.map((group) => group.kind)).toEqual([
      'activity-generate',
      'activity-project',
      'notification-prepare',
      'notification-deliver',
      'reminder-reconcile',
      'session-reminder',
      'session-completion-check',
    ]);

    const generate = overview.groups.find((group) => group.kind === 'activity-generate');
    expect(generate).toMatchObject({
      title: 'Activity generate',
      workerName: 'events-dispatch',
      sampledCount: 2,
      latestProcessedAt: '2026-09-09T11:05:00.000Z',
      unavailable: false,
    });
    expect(generate?.statusCounts).toEqual([
      { status: 'failed', count: 1 },
      { status: 'succeeded', count: 1 },
    ]);
    expect(generate?.records[0]).toMatchObject({
      id: 'g1',
      label: 'message',
      detail: 'dedupe-1',
      attemptCount: 1,
      maxAttempts: 8,
    });

    const deliver = overview.groups.find(
      (group) => group.kind === 'notification-deliver',
    );
    expect(deliver?.sampledCount).toBe(1);
    expect(deliver?.records[0]?.id).toBe('d1');

    const reminder = overview.groups.find((group) => group.kind === 'session-reminder');
    expect(reminder?.sampledCount).toBe(1);
    expect(reminder?.records[0]).toMatchObject({
      id: 'r1',
      label: 'channel · 2026-09-10T09:00:00.000Z',
      detail: 'reminder-1',
    });

    const project = overview.groups.find((group) => group.kind === 'activity-project');
    expect(project?.sampledCount).toBe(0);
  });

  it('scopes the query to a single kind when requested', async () => {
    const from = mockClient({
      accounts: ADMIN_ACCOUNT,
      user_roles: ADMIN_ROLES,
      event_pipeline_jobs: () => makeFilteredQuery(PIPELINE_ROWS),
    });

    const service = new AdminJobActivityService();
    const overview = await service.fetchJobActivity('auth-1', 'org-1', {
      kind: 'notification-deliver',
    });

    expect(overview.groups).toHaveLength(1);
    expect(overview.groups[0]?.kind).toBe('notification-deliver');
    expect(overview.groups[0]?.records[0]?.id).toBe('d1');
    expect(from).not.toHaveBeenCalledWith('reminder_jobs');
  });

  it('returns no groups for an unknown kind', async () => {
    mockClient({ accounts: ADMIN_ACCOUNT, user_roles: ADMIN_ROLES });

    const service = new AdminJobActivityService();
    const overview = await service.fetchJobActivity('auth-1', 'org-1', {
      kind: 'not-a-job',
    });

    expect(overview.groups).toEqual([]);
  });

  it('marks a kind unavailable instead of failing the whole response', async () => {
    mockClient({
      accounts: ADMIN_ACCOUNT,
      user_roles: ADMIN_ROLES,
      event_pipeline_jobs: () =>
        makeErrorQuery(
          "Could not find the table 'public.event_pipeline_jobs' in the schema cache",
        ),
      reminder_jobs: () => makeFilteredQuery(REMINDER_ROWS),
    });

    const service = new AdminJobActivityService();
    const overview = await service.fetchJobActivity('auth-1', 'org-1');

    expect(overview.groups).toHaveLength(7);
    const generate = overview.groups.find((group) => group.kind === 'activity-generate');
    expect(generate?.unavailable).toBe(true);
    expect(generate?.unavailableReason).toContain('schema cache');
    expect(generate?.records).toEqual([]);

    const reminder = overview.groups.find((group) => group.kind === 'session-reminder');
    expect(reminder?.unavailable).toBe(false);
    expect(reminder?.sampledCount).toBe(1);
  });
});
