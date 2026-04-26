import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(),
}));

describe('RemindersService', () => {
  const analytics = { capture: jest.fn() };
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const publishActivityEventMock = jest.mocked(publishActivityEvent);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches only precompiled reminder_jobs and does not read schedules', async () => {
    publishActivityEventMock.mockResolvedValue({ id: 'activity-event-1' } as never);

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
        summary: 'Class starts in 30 minutes',
        reminderOffsetMinutes: 30,
        timezone: 'America/New_York',
        channelId: 'channel-1',
        learningSpaceId: 'space-1',
        scheduleId: 'schedule-1',
        occurrenceStart: '2030-03-06T10:00:00.000Z',
      },
      dedupe_key: 'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:30',
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
      rpc: jest.fn(async () => ({ data: [claimedJob], error: null })),
      from: jest.fn((table: string) => {
        switch (table) {
          case 'profiles':
            return { select: jest.fn(() => profilesSelectChain) };
          case 'reminder_jobs':
            return { update: jest.fn(() => reminderJobsUpdateChain) };
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

    const service = new RemindersService(analytics as never);
    const result = await service.dispatchDueReminderJobs({
      leaseOwner: 'supabase-edge-cron',
      limit: 10,
      leaseSeconds: 90,
    });

    expect(result.claimed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(supabase.rpc).toHaveBeenCalledWith('claim_due_reminder_jobs', {
      p_limit: 10,
      p_lease_owner: 'supabase-edge-cron',
      p_lease_seconds: 90,
    });
    expect(supabase.from).not.toHaveBeenCalledWith('class_schedules');
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'system-profile-1',
        payload: expect.objectContaining({
          reminderOffsetMinutes: 30,
          timezone: 'America/New_York',
        }),
      }),
    );
  });
});
