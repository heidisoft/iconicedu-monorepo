import { EventPipelineService } from '@iconicedu/api/modules/events/event-pipeline.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { projectActivityEvents } from '@iconicedu/api/lib/activity-feed/projector/project-activity-events';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/activity-feed/projector/project-activity-events', () => ({
  projectActivityEvents: jest.fn(),
}));

describe('EventPipelineService', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const projectActivityEventsMock = jest.mocked(projectActivityEvents);
  const activityWorkerService = {
    processEventPipelineGenerationJob: jest.fn(),
  };
  const notificationService = {
    prepareForActivityEvent: jest.fn(),
    deliver: jest.fn(),
  };
  const reminderReconcileService = {
    reconcileNextReminderJobForSchedule: jest.fn(),
  };
  const remindersService = {
    dispatchDueReminderJobs: jest.fn(),
  };

  function makeEqChain() {
    const chain = {
      eq: jest.fn(() => chain),
    };
    return chain;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    projectActivityEventsMock.mockReset();
    activityWorkerService.processEventPipelineGenerationJob.mockReset();
    notificationService.prepareForActivityEvent.mockReset();
    notificationService.deliver.mockReset();
    reminderReconcileService.reconcileNextReminderJobForSchedule.mockReset();
    remindersService.dispatchDueReminderJobs.mockReset();
    jest.useFakeTimers().setSystemTime(new Date('2030-04-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('claims unified jobs and projects activity events', async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    const eqChain = makeEqChain();
    const rpc = jest.fn(async () => ({
      data: [
        {
          id: 'job-1',
          org_id: 'org-1',
          outbox_id: null,
          job_kind: 'activity.project',
          source_id: 'event-1',
          dedupe_key: 'activity.project:event-1',
          payload: { eventId: 'event-1' },
          priority: 60,
          status: 'leased',
          attempt_count: 0,
          max_attempts: 8,
          run_at: '2030-04-01T00:00:00.000Z',
          created_at: '2030-04-01T00:00:00.000Z',
          updated_at: '2030-04-01T00:00:00.000Z',
        },
      ],
      error: null,
    }));
    const from = jest.fn(() => ({
      update: jest.fn((payload) => {
        updates.push(payload);
        return eqChain;
      }),
      insert: jest.fn((payload) => {
        inserts.push(payload);
        return { error: null };
      }),
    }));
    createSupabaseServiceClientMock.mockReturnValue({ rpc, from } as never);
    projectActivityEventsMock.mockResolvedValue({ processed: 1 });

    const service = new EventPipelineService(
      activityWorkerService as never,
      notificationService as never,
      reminderReconcileService as never,
      remindersService as never,
    );

    const result = await service.dispatchDueJobs({
      leaseOwner: 'test-worker',
      limit: 5,
      leaseSeconds: 45,
      jobKinds: ['activity.project'],
    });

    expect(rpc).toHaveBeenCalledWith('claim_due_event_pipeline_jobs', {
      p_limit: 5,
      p_lease_owner: 'test-worker',
      p_lease_seconds: 45,
      p_job_kinds: ['activity.project'],
    });
    expect(projectActivityEventsMock).toHaveBeenCalledWith(expect.anything(), {
      eventIds: ['event-1'],
      limit: 1,
    });
    expect(updates).toContainEqual(
      expect.objectContaining({
        status: 'succeeded',
        dispatched_at: '2030-04-01T00:00:00.000Z',
        lease_owner: null,
        lease_until: null,
      }),
    );
    expect(inserts).toContainEqual(
      expect.objectContaining({
        org_id: 'org-1',
        job_id: 'job-1',
        job_kind: 'activity.project',
        result: 'succeeded',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ claimed: 1, succeeded: 1, failed: 0 }),
    );
  });

  it('marks invalid notification delivery payloads dead letter', async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    const eqChain = makeEqChain();
    const rpc = jest.fn(async () => ({
      data: [
        {
          id: 'job-1',
          org_id: 'org-1',
          outbox_id: 'outbox-1',
          job_kind: 'notification.deliver',
          source_id: 'event-1',
          dedupe_key: 'notification.deliver:event-1',
          payload: {},
          priority: 80,
          status: 'leased',
          attempt_count: 7,
          max_attempts: 8,
          run_at: '2030-04-01T00:00:00.000Z',
          created_at: '2030-04-01T00:00:00.000Z',
          updated_at: '2030-04-01T00:00:00.000Z',
        },
      ],
      error: null,
    }));
    const from = jest.fn(() => ({
      update: jest.fn((payload) => {
        updates.push(payload);
        return eqChain;
      }),
      insert: jest.fn((payload) => {
        inserts.push(payload);
        return { error: null };
      }),
    }));
    createSupabaseServiceClientMock.mockReturnValue({ rpc, from } as never);
    notificationService.deliver.mockRejectedValue(
      new Error('Invalid notification delivery payload'),
    );

    const service = new EventPipelineService(
      activityWorkerService as never,
      notificationService as never,
      reminderReconcileService as never,
      remindersService as never,
    );

    const result = await service.dispatchDueJobs({ leaseOwner: 'test-worker' });

    expect(updates).toContainEqual(
      expect.objectContaining({
        status: 'dead_letter',
        attempt_count: 8,
        next_attempt_at: null,
        last_error: 'Invalid notification delivery payload',
      }),
    );
    expect(updates).toContainEqual(
      expect.objectContaining({
        status: 'dead_letter',
        last_error: 'Invalid notification delivery payload',
      }),
    );
    expect(inserts).toContainEqual(
      expect.objectContaining({
        org_id: 'org-1',
        job_id: 'job-1',
        outbox_id: 'outbox-1',
        job_kind: 'notification.deliver',
        result: 'fatal_failure',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ claimed: 1, failed: 1, deadLettered: 1 }),
    );
  });
});
