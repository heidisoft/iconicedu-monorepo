import { ActivityFeedService } from '@iconicedu/api/modules/activity-feed/activity-feed.service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(async () => ({ id: 'activity-event-1' })),
}));

describe('ActivityFeedService', () => {
  const publishActivityEventMock = jest.mocked(publishActivityEvent);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeChain<T>(result: { data: T; error?: null }) {
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      is: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => result),
      returns: jest.fn(async () => result),
    };
    return chain;
  }

  it('publishes dispute reported events to staff only', async () => {
    const sessionChain = makeChain({
      data: {
        id: 'schedule-1',
        title: 'Algebra',
        source_channel_id: 'channel-1',
        source_learning_space_id: 'space-1',
        participants: [
          {
            profile_id: 'educator-1',
            role: 'educator',
            display_name: 'Ada Teacher',
          },
        ],
      },
    });
    const reporterChain = makeChain({ data: { display_name: 'Alex Student' } });
    const staffChain = makeChain({
      data: [{ id: 'staff-1' }, { id: 'staff-2' }],
    });
    const from = jest.fn((table: string) => {
      if (table === 'class_schedules') return sessionChain;
      if (table === 'profiles' && from.mock.calls.length === 2) return reporterChain;
      if (table === 'profiles') return staffChain;
      throw new Error(`Unexpected table: ${table}`);
    });
    const supabase = { from };
    const service = new ActivityFeedService();

    await (
      service as unknown as {
        publishDisputeNotifications(input: {
          supabase: typeof supabase;
          orgId: string;
          scheduleId: string;
          occurrenceKey: string;
          reportedByProfileId: string;
          reportedByRole: string;
          disputeCategory: string;
          disputeReason: string | null;
          rescheduleRequested: boolean;
        }): Promise<void>;
      }
    ).publishDisputeNotifications({
      supabase,
      orgId: 'org-1',
      scheduleId: 'schedule-1',
      occurrenceKey: '2030-03-01T10:00:00.000Z',
      reportedByProfileId: 'student-1',
      reportedByRole: 'child',
      disputeCategory: 'teacher_absent',
      disputeReason: 'Teacher did not join',
      rescheduleRequested: true,
    });

    expect(publishActivityEventMock).toHaveBeenCalledTimes(1);
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.completion.dispute_reported',
        audienceRules: [{ kind: 'users_only', userIds: ['staff-1', 'staff-2'] }],
        payload: expect.objectContaining({
          recipientRole: 'staff',
          educatorNames: 'Ada Teacher',
        }),
        dedupeKey: 'dispute:schedule-1:2030-03-01T10:00:00.000Z:staff:student-1',
      }),
    );
  });
});
