import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildClassSchedulesByOrgMock,
  expandRecurringEventsMock,
  publishActivityEventMock,
} = vi.hoisted(() => ({
  buildClassSchedulesByOrgMock: vi.fn(),
  expandRecurringEventsMock: vi.fn(),
  publishActivityEventMock: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/schedules/builders/class-schedule.builder', () => ({
  buildClassSchedulesByOrg: (...args: unknown[]) => buildClassSchedulesByOrgMock(...args),
}));

vi.mock('@iconicedu/ui-web/lib/class-schedule-utils', () => ({
  expandRecurringEvents: (...args: unknown[]) => expandRecurringEventsMock(...args),
}));

vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: (...args: unknown[]) => publishActivityEventMock(...args),
}));

import {
  compileLearningSpaceReminderJobs,
  dispatchDueReminderJobs,
} from '@iconicedu/web/lib/automation/reminder-jobs';

function createInsertChain<T>(result: T) {
  const chain = {
    select: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: result, error: null })),
  };
  return chain;
}

describe('reminder-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles learning-space reminder jobs from expanded occurrences', async () => {
    buildClassSchedulesByOrgMock.mockResolvedValue([
      {
        ids: { id: 'schedule-1', orgId: 'org-1' },
        title: 'Algebra',
        description: 'Bring your workbook',
        startAt: '2026-03-06T10:00:00.000Z',
        endAt: '2026-03-06T11:00:00.000Z',
        timezone: 'UTC',
        status: 'scheduled',
        source: {
          kind: 'class_session',
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
        },
      },
    ]);

    expandRecurringEventsMock.mockReturnValue([
      {
        ids: { id: 'schedule-1__2026-03-06T10:00:00.000Z', orgId: 'org-1' },
        title: 'Algebra',
        description: 'Bring your workbook',
        startAt: '2026-03-06T10:00:00.000Z',
        endAt: '2026-03-06T11:00:00.000Z',
        timezone: 'UTC',
        status: 'scheduled',
        location: null,
        meetingLink: null,
        source: {
          kind: 'class_session',
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
        },
      },
    ]);

    const reminderJobsTable = {
      upsert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => reminderJobsTable),
      eq: vi.fn(() => reminderJobsTable),
      in: vi.fn(() => reminderJobsTable),
      is: vi.fn(() => reminderJobsTable),
      returns: vi.fn(async () => ({ data: [], error: null })),
      update: vi.fn(() => reminderJobsTable),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== 'reminder_jobs') {
          throw new Error(`Unexpected table ${table}`);
        }
        return reminderJobsTable;
      }),
    } as never;

    const result = await compileLearningSpaceReminderJobs({
      supabase,
      orgId: 'org-1',
      learningSpaceId: 'space-1',
    });

    expect(result.compiledCount).toBe(2);
    expect(reminderJobsTable.upsert).toHaveBeenCalledTimes(1);
  });

  it('dispatches claimed jobs and publishes activity events', async () => {
    publishActivityEventMock.mockResolvedValue({ id: 'activity-event-1' });

    const claimedJob = {
      id: 'job-1',
      org_id: 'org-1',
      job_type: 'session.reminder',
      target_kind: 'channel',
      target_id: 'channel-1',
      payload: {
        title: 'Algebra',
        summary: 'Class starts in 10 minutes',
        channelId: 'channel-1',
        learningSpaceId: 'space-1',
        scheduleId: 'schedule-1',
        occurrenceStart: '2026-03-06T10:00:00.000Z',
      },
      dedupe_key: 'session.reminder:org-1:schedule-1:2026-03-06T10:00:00.000Z',
      attempt_count: 0,
      max_attempts: 8,
    };

    const profilesSelectChain = {
      eq: vi.fn(() => profilesSelectChain),
      is: vi.fn(() => profilesSelectChain),
      order: vi.fn(() => profilesSelectChain),
      limit: vi.fn(() => profilesSelectChain),
      maybeSingle: vi.fn(async () => ({ data: { id: 'system-profile-1' }, error: null })),
    };

    const messagesInsertChain = createInsertChain({ id: 'message-1' });

    const reminderJobsUpdateChain = {
      eq: vi.fn(() => reminderJobsUpdateChain),
    };

    const reminderJobsTable = {
      update: vi.fn(() => reminderJobsUpdateChain),
    };

    const dispatchLogsTable = {
      insert: vi.fn(async () => ({ error: null })),
    };

    const payloadTable = {
      insert: vi.fn(async () => ({ error: null })),
    };

    const supabase = {
      rpc: vi.fn(async () => ({ data: [claimedJob], error: null })),
      from: vi.fn((table: string) => {
        switch (table) {
          case 'profiles':
            return {
              select: vi.fn(() => profilesSelectChain),
            };
          case 'messages':
            return {
              insert: vi.fn(() => messagesInsertChain),
            };
          case 'message_event_reminder':
            return payloadTable;
          case 'reminder_jobs':
            return reminderJobsTable;
          case 'reminder_dispatch_logs':
            return dispatchLogsTable;
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    } as never;

    const result = await dispatchDueReminderJobs({
      supabase,
      leaseOwner: 'test-worker',
      limit: 10,
      leaseSeconds: 90,
    });

    expect(result).toEqual({
      claimed: 1,
      succeeded: 1,
      failed: 0,
      deadLettered: 0,
    });
    expect(publishActivityEventMock).toHaveBeenCalledTimes(1);
    expect(payloadTable.insert).toHaveBeenCalledTimes(1);
    expect(dispatchLogsTable.insert).toHaveBeenCalledTimes(1);
  });
});
