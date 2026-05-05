import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import { ActivityWorkerService } from '@iconicedu/api/modules/activity-worker/activity-worker.service';

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/messages/message-activity', () => ({
  publishReactionAddedActivity: jest.fn(),
  publishTextMessagePostSendActivities: jest.fn(),
  resolveActivityChannelContext: jest.fn(),
  resolveVisibilityAudienceFromMessageRow: jest.fn(),
}));

const context = {
  learningSpaceId: 'space-1',
  channelId: 'channel-1',
  scheduleId: 'schedule-1',
  title: 'Algebra I',
  timezone: 'America/New_York',
  invitedMembers: [],
  firstSessionStartAt: '2026-03-21T14:00:00.000Z',
  firstSessionTimezone: 'America/New_York',
};

function makeSupabase(sourceRow: Record<string, unknown>) {
  return {
    from: jest.fn(() => {
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        is: jest.fn(() => query),
        maybeSingle: jest.fn(async () => ({ data: sourceRow, error: null })),
      };
      return query;
    }),
  };
}

function makeService() {
  const service = new ActivityWorkerService() as unknown as ActivityWorkerService & {
    resolveLearningSpaceContextFromRecurrence: jest.Mock;
    resolveScheduleActorProfileId: jest.Mock;
    processSessionCancelJob(job: unknown, supabase: unknown): Promise<void>;
    processSessionRescheduleJob(job: unknown, supabase: unknown): Promise<void>;
  };
  service.resolveLearningSpaceContextFromRecurrence = jest.fn(async () => context);
  service.resolveScheduleActorProfileId = jest.fn(async () => 'actor-1');
  return service;
}

describe('ActivityWorkerService schedule notification suppression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies cancellation suppression into the activity payload', async () => {
    const service = makeService();

    await service.processSessionCancelJob(
      { id: 'job-1', org_id: 'org-1', exception_id: 'exception-1' },
      makeSupabase({
        id: 'exception-1',
        recurrence_id: 'recurrence-1',
        occurrence_key: '2026-03-21T14:00:00.000Z',
        reason: 'Weather',
        suppress_notifications: true,
        created_by: 'actor-1',
      }),
    );

    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'class.session.canceled',
        payload: expect.objectContaining({ suppressNotifications: true }),
      }),
    );
  });

  it('copies reschedule suppression into the activity payload', async () => {
    const service = makeService();

    await service.processSessionRescheduleJob(
      { id: 'job-1', org_id: 'org-1', override_id: 'override-1' },
      makeSupabase({
        id: 'override-1',
        recurrence_id: 'recurrence-1',
        occurrence_key: '2026-03-21T14:00:00.000Z',
        patch: {
          startAt: '2026-03-22T15:00:00.000Z',
          reason: 'Family requested a change',
        },
        suppress_notifications: true,
        created_by: 'actor-1',
      }),
    );

    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'class.session.rescheduled',
        payload: expect.objectContaining({ suppressNotifications: true }),
      }),
    );
  });
});
