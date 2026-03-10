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
        participants: [
          {
            ids: { id: 'profile-1', orgId: 'org-1' },
            displayName: 'Alex Student',
            avatarUrl: 'https://cdn.test/alex.png',
            themeKey: 'blue',
          },
        ],
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

    expect(result.compiledCount).toBe(3);
    expect(reminderJobsTable.upsert).toHaveBeenCalledTimes(1);
    const compiledRows = reminderJobsTable.upsert.mock.calls[0]?.[0] as Array<{
      job_type: string;
      dedupe_key: string;
      run_at: string;
      payload: { summary?: string | null; members?: Array<{ profileId: string }> };
    }>;
    const reminderRows = compiledRows
      .filter((row) => row.job_type === 'session.reminder')
      .sort((a, b) => a.run_at.localeCompare(b.run_at));
    expect(reminderRows).toHaveLength(2);
    expect(reminderRows.map((row) => row.run_at)).toEqual([
      '2026-03-06T09:30:00.000Z',
      '2026-03-06T09:55:00.000Z',
    ]);
    expect(reminderRows.map((row) => row.payload.summary)).toEqual([
      'Class starts in 30 minutes',
      'Class starts in 5 minutes',
    ]);
    expect(reminderRows[0]?.dedupe_key).toContain(':30');
    expect(reminderRows[1]?.dedupe_key).toContain(':5');
    const feedbackRow = compiledRows.find(
      (row) => row.job_type === 'session.feedback_request',
    );
    expect(feedbackRow?.run_at).toBe('2026-03-06T12:00:00.000Z');
    expect(feedbackRow?.payload.members?.[0]).toMatchObject({
      profileId: 'profile-1',
    });
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
        members: [
          {
            profileId: 'profile-1',
            displayName: 'Alex Student',
            avatarUrl: 'https://cdn.test/alex.png',
            themeKey: 'blue',
          },
        ],
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

    const reminderJobsUpdateChain = {
      eq: vi.fn(() => reminderJobsUpdateChain),
    };

    const reminderJobsTable = {
      update: vi.fn(() => reminderJobsUpdateChain),
    };

    const dispatchLogsTable = {
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
          case 'reminder_jobs':
            return reminderJobsTable;
          case 'reminder_dispatch_logs':
            return dispatchLogsTable;
          case 'messages':
          case 'message_event_reminder':
          case 'message_payment_reminder':
          case 'message_feedback_request':
            throw new Error(`Unexpected table ${table}`);
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
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        objectRef: undefined,
        payload: expect.objectContaining({
          messageId: null,
          members: [
            expect.objectContaining({
              profileId: 'profile-1',
            }),
          ],
        }),
      }),
    );
    expect(dispatchLogsTable.insert).toHaveBeenCalledTimes(1);
  });

  it('dispatches session.feedback_request without creating message rows', async () => {
    publishActivityEventMock.mockResolvedValue({ id: 'activity-event-1' });

    const claimedJob = {
      id: 'job-feedback-1',
      org_id: 'org-1',
      job_type: 'session.feedback_request',
      target_kind: 'channel',
      target_id: 'channel-1',
      payload: {
        title: 'Algebra',
        channelId: 'channel-1',
        learningSpaceId: 'space-1',
        scheduleId: 'schedule-1',
        occurrenceStart: '2026-03-06T10:00:00.000Z',
      },
      dedupe_key: 'session.feedback_request:org-1:schedule-1:2026-03-06T10:00:00.000Z',
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

    const reminderJobsUpdateChain = {
      eq: vi.fn(() => reminderJobsUpdateChain),
    };

    const reminderJobsTable = {
      update: vi.fn(() => reminderJobsUpdateChain),
    };

    const dispatchLogsTable = {
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
          case 'reminder_jobs':
            return reminderJobsTable;
          case 'reminder_dispatch_logs':
            return dispatchLogsTable;
          case 'messages':
          case 'message_feedback_request':
            throw new Error(`Unexpected table ${table}`);
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
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.feedback_request.sent',
        objectRef: undefined,
        payload: expect.objectContaining({
          messageId: null,
        }),
      }),
    );
    expect(dispatchLogsTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: null,
      }),
    );
  });
});
