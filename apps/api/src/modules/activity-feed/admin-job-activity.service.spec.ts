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

function makeListQuery<T>(rows: T[]) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    returns: jest.fn(async () => ({ data: rows, error: null })),
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
const ADMIN_ROLES = () => makeListQuery([{ role_key: 'admin' }]);

describe('AdminJobActivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects callers without an admin role', async () => {
    mockClient({
      accounts: () => makeSingleQuery({ id: 'account-1' }),
      user_roles: () => makeListQuery([{ role_key: 'member' }]),
    });

    const service = new AdminJobActivityService();

    await expect(service.fetchJobActivity('auth-1', 'org-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns a group per job queue with derived status counts', async () => {
    const from = mockClient({
      accounts: ADMIN_ACCOUNT,
      user_roles: ADMIN_ROLES,
      activity_source_jobs: () =>
        makeListQuery([
          {
            id: 'a1',
            status: 'succeeded',
            job_kind: 'message',
            dedupe_key: 'dedupe-1',
            attempt_count: 1,
            max_attempts: 8,
            run_at: '2026-09-09T10:00:00.000Z',
            dispatched_at: '2026-09-09T10:01:00.000Z',
            created_at: '2026-09-09T09:59:00.000Z',
            updated_at: '2026-09-09T10:01:00.000Z',
          },
          {
            id: 'a2',
            status: 'failed',
            job_kind: 'reaction',
            dedupe_key: 'dedupe-2',
            attempt_count: 3,
            max_attempts: 8,
            last_error: 'boom',
            run_at: '2026-09-09T11:00:00.000Z',
            dispatched_at: '2026-09-09T11:05:00.000Z',
            created_at: '2026-09-09T10:59:00.000Z',
            updated_at: '2026-09-09T11:05:00.000Z',
          },
        ]),
      event_pipeline_jobs: () => makeListQuery([]),
      notification_dispatch_jobs: () => makeListQuery([]),
      reminder_jobs: () => makeListQuery([]),
      reminder_reconcile_jobs: () => makeListQuery([]),
      class_session_completions: () => makeListQuery([]),
    });

    const service = new AdminJobActivityService();
    const overview = await service.fetchJobActivity('auth-1', 'org-1');

    expect(overview.groups).toHaveLength(6);

    const activitySource = overview.groups.find(
      (group) => group.kind === 'activity-source',
    );
    expect(activitySource).toMatchObject({
      title: 'Activity source jobs',
      workerName: 'events-dispatch',
      sampledCount: 2,
      latestProcessedAt: '2026-09-09T11:05:00.000Z',
    });
    expect(activitySource?.statusCounts).toEqual([
      { status: 'failed', count: 1 },
      { status: 'succeeded', count: 1 },
    ]);
    expect(activitySource?.records[0]).toMatchObject({
      id: 'a1',
      label: 'message',
      detail: 'dedupe-1',
      attemptCount: 1,
      maxAttempts: 8,
    });

    expect(from).toHaveBeenCalledWith('class_session_completions');
  });

  it('scopes the query to a single kind when requested', async () => {
    const from = mockClient({
      accounts: ADMIN_ACCOUNT,
      user_roles: ADMIN_ROLES,
      notification_dispatch_jobs: () =>
        makeListQuery([
          {
            id: 'n1',
            status: 'pending',
            delivery_channel: 'push',
            pref_key: 'dm.message',
            delivery_timing: 'immediate',
            attempt_bucket: 'first',
            attempt_count: 0,
            max_attempts: 8,
            created_at: '2026-09-09T12:00:00.000Z',
            updated_at: '2026-09-09T12:00:00.000Z',
          },
        ]),
    });

    const service = new AdminJobActivityService();
    const overview = await service.fetchJobActivity('auth-1', 'org-1', {
      kind: 'notification-dispatch',
    });

    expect(overview.groups).toHaveLength(1);
    expect(overview.groups[0]?.kind).toBe('notification-dispatch');
    expect(overview.groups[0]?.records[0]?.label).toBe('push · dm.message');
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
});
