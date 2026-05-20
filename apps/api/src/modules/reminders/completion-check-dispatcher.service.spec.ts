import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import { CompletionCheckDispatcherService } from '@iconicedu/api/modules/reminders/completion-check-dispatcher.service';

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(async () => ({ id: 'activity-event-1' })),
}));

describe('CompletionCheckDispatcherService', () => {
  const publishActivityEventMock = jest.mocked(publishActivityEvent);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeQuery<T>(result: { data: T; error: null }) {
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      in: jest.fn(() => query),
      is: jest.fn(() => query),
      neq: jest.fn(() => query),
      gte: jest.fn(() => query),
      lte: jest.fn(() => query),
      limit: jest.fn(async () => result),
      returns: jest.fn(async () => result),
    };
    return query;
  }

  function makeSupabase() {
    const existingVotesQuery = makeQuery({ data: [], error: null });
    const childProfilesQuery = makeQuery({
      data: [{ id: 'child-1', account_id: 'account-child-1', kind: 'child' }],
      error: null,
    });
    const familyLinksQuery = makeQuery({
      data: [
        {
          guardian_account_id: 'account-guardian-1',
          child_account_id: 'account-child-1',
        },
      ],
      error: null,
    });
    const guardianProfilesQuery = makeQuery({
      data: [
        {
          id: 'guardian-1',
          account_id: 'account-guardian-1',
          kind: 'guardian',
          display_name: 'Parent One',
          first_name: null,
          last_name: null,
          avatar_url: 'https://cdn.test/guardian.png',
          ui_theme_key: 'mint',
        },
      ],
      error: null,
    });
    const concurrentSchedulesQuery = makeQuery({ data: [], error: null });
    let profilesCallCount = 0;

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'class_session_completion_votes') {
          return { select: jest.fn(() => existingVotesQuery) };
        }
        if (table === 'family_links') {
          return { select: jest.fn(() => familyLinksQuery) };
        }
        if (table === 'class_schedules') {
          return { select: jest.fn(() => concurrentSchedulesQuery) };
        }
        if (table === 'profiles') {
          profilesCallCount += 1;
          return {
            select: jest.fn(() =>
              profilesCallCount === 1 ? childProfilesQuery : guardianProfilesQuery,
            ),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    return { supabase };
  }

  it('dispatches completion checks to linked parents even when they are not schedule participants', async () => {
    const { supabase } = makeSupabase();
    const service = new CompletionCheckDispatcherService();

    await service.dispatchCompletionCheck({
      supabase: supabase as never,
      systemProfileId: 'system-profile-1',
      job: {
        id: 'job-1',
        org_id: 'org-1',
        source_schedule_id: 'schedule-1',
      } as never,
      payload: {
        title: 'Math with Ms. Shenaly',
        summary: 'How was your class?',
        channelId: 'channel-1',
        learningSpaceId: 'space-1',
        scheduleId: 'schedule-1',
        occurrenceStart: '2030-03-06T10:00:00.000Z',
        startAt: '2030-03-06T10:00:00.000Z',
        endAt: '2030-03-06T11:00:00.000Z',
        channelRouteKind: 'space',
        members: [
          {
            profileId: 'child-1',
            role: 'child',
            displayName: 'Arya A',
            avatarUrl: null,
            themeKey: null,
          },
          {
            profileId: 'teacher-1',
            role: 'educator',
            displayName: 'Ms. Shenaly',
            avatarUrl: null,
            themeKey: null,
          },
        ],
      },
    });

    expect(publishActivityEventMock).toHaveBeenCalledTimes(3);
    expect(publishActivityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session.completion_check.sent',
        audienceRules: [{ kind: 'users_only', userIds: ['guardian-1'] }],
        dedupeKey:
          'session.completion_check:org-1:schedule-1:2030-03-06T10:00:00.000Z:guardian-1',
        payload: expect.objectContaining({
          title: 'Math with Ms. Shenaly',
          members: expect.arrayContaining([
            expect.objectContaining({
              profileId: 'child-1',
              role: 'child',
              displayName: 'Arya A',
            }),
            expect.objectContaining({
              profileId: 'teacher-1',
              role: 'educator',
              displayName: 'Ms. Shenaly',
            }),
          ]),
        }),
      }),
    );
  });
});
