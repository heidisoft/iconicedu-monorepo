import { ReminderReconcileWorkerService } from '@iconicedu/api/modules/reminders/reminder-reconcile-worker.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe('ReminderReconcileWorkerService', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const reconcileNextReminderJobForSchedule = jest.fn();
  const analytics = { capture: jest.fn() };

  function makeUpdateChain() {
    const chain = {
      eq: jest.fn(() => chain),
    };
    return chain;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2030-03-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('claims reconcile jobs, reconciles schedules, and marks jobs succeeded', async () => {
    const updateChain = makeUpdateChain();
    const update = jest.fn(() => updateChain);
    const rpc = jest.fn(async () => ({
      data: [
        {
          id: 'job-1',
          org_id: 'org-1',
          schedule_id: 'schedule-1',
          dedupe_key: 'schedule:schedule-1',
          status: 'leased',
          attempt_count: 0,
          max_attempts: 8,
          run_at: '2030-03-01T00:00:00.000Z',
          created_at: '2030-03-01T00:00:00.000Z',
          updated_at: '2030-03-01T00:00:00.000Z',
        },
      ],
      error: null,
    }));
    createSupabaseServiceClientMock.mockReturnValue({
      rpc,
      from: jest.fn(() => ({
        update: jest.fn((payload) => {
          update(payload);
          return updateChain;
        }),
      })),
    } as never);
    reconcileNextReminderJobForSchedule.mockResolvedValue({ action: 'inserted' });

    const service = new ReminderReconcileWorkerService(
      { reconcileNextReminderJobForSchedule } as never,
      analytics as never,
    );

    const result = await service.dispatchDuePendingJobs({
      leaseOwner: 'test-worker',
      limit: 10,
      leaseSeconds: 60,
    });

    expect(rpc).toHaveBeenCalledWith('claim_due_reminder_reconcile_jobs', {
      p_limit: 10,
      p_lease_owner: 'test-worker',
      p_lease_seconds: 60,
    });
    expect(reconcileNextReminderJobForSchedule).toHaveBeenCalledWith({
      orgId: 'org-1',
      scheduleId: 'schedule-1',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        dispatched_at: '2030-03-01T00:00:00.000Z',
        lease_owner: null,
        lease_until: null,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ claimed: 1, succeeded: 1, failed: 0 }),
    );
  });

  it('marks non-retryable reconcile failures dead_letter', async () => {
    const updateChain = makeUpdateChain();
    const updates: unknown[] = [];
    const rpc = jest.fn(async () => ({
      data: [
        {
          id: 'job-1',
          org_id: 'org-1',
          schedule_id: 'schedule-1',
          dedupe_key: 'schedule:schedule-1',
          status: 'leased',
          attempt_count: 7,
          max_attempts: 8,
          run_at: '2030-03-01T00:00:00.000Z',
          created_at: '2030-03-01T00:00:00.000Z',
          updated_at: '2030-03-01T00:00:00.000Z',
        },
      ],
      error: null,
    }));
    createSupabaseServiceClientMock.mockReturnValue({
      rpc,
      from: jest.fn(() => ({
        update: jest.fn((payload) => {
          updates.push(payload);
          return updateChain;
        }),
      })),
    } as never);
    reconcileNextReminderJobForSchedule.mockRejectedValue(new Error('Forbidden'));

    const service = new ReminderReconcileWorkerService(
      { reconcileNextReminderJobForSchedule } as never,
      analytics as never,
    );

    const result = await service.dispatchDuePendingJobs({
      leaseOwner: 'test-worker',
    });

    expect(updates).toContainEqual(
      expect.objectContaining({
        status: 'dead_letter',
        attempt_count: 8,
        next_attempt_at: null,
        last_error: 'Forbidden',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ claimed: 1, failed: 1, deadLettered: 1 }),
    );
  });
});
