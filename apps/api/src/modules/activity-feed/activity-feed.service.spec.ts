import { ActivityFeedService } from '@iconicedu/api/modules/activity-feed/activity-feed.service';
import { publishActivityEvent } from '@iconicedu/api/lib/activity-feed/activity-publisher';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

jest.mock('@iconicedu/api/lib/activity-feed/activity-publisher', () => ({
  publishActivityEvent: jest.fn(async () => ({ id: 'activity-event-1' })),
}));

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe('ActivityFeedService', () => {
  const publishActivityEventMock = jest.mocked(publishActivityEvent);
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeChain<T>(result: { data: T; error?: null }) {
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      in: jest.fn(() => chain),
      is: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => result),
      returns: jest.fn(async () => result),
      upsert: jest.fn(async () => ({ error: null })),
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

  it('allows linked guardians to submit completion votes for their child session', async () => {
    const orgId = '00000000-0000-4000-8000-000000000001';
    const scheduleId = '00000000-0000-4000-8000-000000000002';
    const guardianProfileId = '00000000-0000-4000-8000-000000000003';
    const childProfileId = '00000000-0000-4000-8000-000000000004';
    const guardianAccountId = '00000000-0000-4000-8000-000000000005';
    const childAccountId = '00000000-0000-4000-8000-000000000006';

    const authAccountChain = makeChain({
      data: { id: guardianAccountId, org_id: orgId },
    });
    const activeProfileChain = makeChain({
      data: { active_profile_id: guardianProfileId },
    });
    const directParticipantChain = makeChain({ data: null });
    const guardianProfileChain = makeChain({
      data: {
        id: guardianProfileId,
        account_id: guardianAccountId,
        org_id: orgId,
        kind: 'guardian',
      },
    });
    const familyLinksChain = makeChain({
      data: [{ child_account_id: childAccountId }],
    });
    const childProfilesChain = makeChain({
      data: [{ id: childProfileId }],
    });
    const childParticipantChain = makeChain({
      data: { id: 'participant-child-1' },
    });
    const votesChain = makeChain({ data: null });

    const tableCalls: string[] = [];
    let accountCallCount = 0;
    let participantCallCount = 0;
    let profilesCallCount = 0;
    const supabase = {
      from: jest.fn((table: string) => {
        tableCalls.push(table);
        if (table === 'accounts') {
          accountCallCount += 1;
          return accountCallCount === 1 ? authAccountChain : activeProfileChain;
        }
        if (table === 'class_schedule_participants') {
          participantCallCount += 1;
          return participantCallCount === 1
            ? directParticipantChain
            : childParticipantChain;
        }
        if (table === 'profiles') {
          profilesCallCount += 1;
          return profilesCallCount <= 2 ? guardianProfileChain : childProfilesChain;
        }
        if (table === 'family_links') return familyLinksChain;
        if (table === 'class_session_completion_votes') return votesChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = new ActivityFeedService();
    await service.submitCompletionVote('auth-user-1', {
      orgId,
      scheduleId,
      occurrenceKey: '2030-03-06T10:00:00.000Z',
      role: 'guardian',
      status: 'confirmed',
    });

    expect(tableCalls).toContain('family_links');
    expect(childParticipantChain.in).toHaveBeenCalledWith('profile_id', [childProfileId]);
    expect(votesChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: orgId,
        schedule_id: scheduleId,
        profile_id: guardianProfileId,
        role: 'guardian',
        status: 'confirmed',
      }),
      { onConflict: 'org_id,schedule_id,occurrence_key,profile_id' },
    );
  });

  it('stores completion votes on the requested recipient profile when provided', async () => {
    const orgId = '00000000-0000-4000-8000-000000000001';
    const scheduleId = '00000000-0000-4000-8000-000000000002';
    const childProfileId = '00000000-0000-4000-8000-000000000004';
    const guardianAccountId = '00000000-0000-4000-8000-000000000005';
    const childAccountId = '00000000-0000-4000-8000-000000000006';

    const authAccountChain = makeChain({
      data: { id: guardianAccountId, org_id: orgId },
    });
    const requestedProfileChain = makeChain({
      data: {
        id: childProfileId,
        account_id: childAccountId,
        org_id: orgId,
      },
    });
    const familyLinkChain = makeChain({
      data: { child_account_id: childAccountId },
    });
    const directParticipantChain = makeChain({
      data: { id: 'participant-child-1', role: 'child' },
    });
    const votesChain = makeChain({ data: null });

    const tableCalls: string[] = [];
    const supabase = {
      from: jest.fn((table: string) => {
        tableCalls.push(table);
        if (table === 'accounts') return authAccountChain;
        if (table === 'profiles') return requestedProfileChain;
        if (table === 'family_links') return familyLinkChain;
        if (table === 'class_schedule_participants') return directParticipantChain;
        if (table === 'class_session_completion_votes') return votesChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    createSupabaseServiceClientMock.mockReturnValue(supabase as never);

    const service = new ActivityFeedService();
    await service.submitCompletionVote('auth-user-1', {
      orgId,
      scheduleId,
      occurrenceKey: '2030-03-06T10:00:00.000Z',
      role: 'guardian',
      status: 'confirmed',
      recipientProfileId: childProfileId,
    });

    expect(tableCalls.filter((table) => table === 'accounts')).toHaveLength(1);
    expect(familyLinkChain.eq).toHaveBeenCalledWith('child_account_id', childAccountId);
    expect(votesChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: orgId,
        schedule_id: scheduleId,
        profile_id: childProfileId,
        role: 'child',
        status: 'confirmed',
      }),
      { onConflict: 'org_id,schedule_id,occurrence_key,profile_id' },
    );
  });
});
