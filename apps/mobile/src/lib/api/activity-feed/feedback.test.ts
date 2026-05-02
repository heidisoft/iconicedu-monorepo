import { submitActivityFeedFeedback } from './feedback';

const mockGetSession = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function createMaybeSingleChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.select = jest.fn(returnChain);
  chain.eq = jest.fn(returnChain);
  chain.is = jest.fn(returnChain);
  chain.or = jest.fn(returnChain);
  chain.limit = jest.fn(returnChain);
  chain.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createUpsertSingleChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const returnChain = () => chain;
  chain.upsert = jest.fn(returnChain);
  chain.select = jest.fn(returnChain);
  chain.single = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createActiveClassroomChain() {
  return createMaybeSingleChain({
    data: { status: 'active', archived_at: null },
    error: null,
  });
}

describe('submitActivityFeedFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes feedback directly to supabase', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });

    const activityChain = createMaybeSingleChain({
      data: { id: 'activity-1' },
      error: null,
    });
    const scheduleChain = createMaybeSingleChain({
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        source_session_id: null,
      },
      error: null,
    });
    const upsertChain = createUpsertSingleChain({
      data: {
        source_event_id: '11111111-1111-4111-8111-111111111111',
        message_id: null,
        class_session_id: '33333333-3333-4333-8333-333333333333',
        classroom_id: '44444444-4444-4444-8444-444444444444',
        channel_id: '55555555-5555-4555-8555-555555555555',
        occurrence_start_at: '2026-03-16T10:00:00.000Z',
        rating: 5,
        comment: null,
        submitted_at: '2026-03-16T10:01:00.000Z',
      },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(createActiveClassroomChain())
      .mockReturnValueOnce(activityChain)
      .mockReturnValueOnce(scheduleChain)
      .mockReturnValueOnce(upsertChain);

    const result = await submitActivityFeedFeedback({
      orgId: 'org-1',
      classSessionId: '33333333-3333-4333-8333-333333333333',
      classroomId: '44444444-4444-4444-8444-444444444444',
      channelId: '55555555-5555-4555-8555-555555555555',
      sourceEventId: '11111111-1111-4111-8111-111111111111',
      occurrenceStartAt: '2026-03-16T10:00:00.000Z',
      rating: 5,
      comment: null,
      recipientProfileId: 'profile-1',
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'learning_spaces');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'activity_feed_items');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'class_schedules');
    expect(mockFrom).toHaveBeenNthCalledWith(4, 'class_session_feedback');
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        recipient_profile_id: 'profile-1',
        class_session_id: '33333333-3333-4333-8333-333333333333',
        rating: 5,
      }),
      { onConflict: 'org_id,recipient_profile_id,class_session_id' },
    );
    expect(result).toMatchObject({ rating: 5 });
  });

  it('checks message membership before writing when messageId is present', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });

    const activityChain = createMaybeSingleChain({
      data: { id: 'activity-1' },
      error: null,
    });
    const scheduleChain = createMaybeSingleChain({
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        source_session_id: null,
      },
      error: null,
    });
    const messageChain = createMaybeSingleChain({
      data: { channel_id: 'channel-1' },
      error: null,
    });
    const membershipChain = createMaybeSingleChain({
      data: { id: 'member-1' },
      error: null,
    });
    const upsertChain = createUpsertSingleChain({
      data: {
        source_event_id: '11111111-1111-4111-8111-111111111111',
        message_id: '22222222-2222-4222-8222-222222222222',
        class_session_id: '33333333-3333-4333-8333-333333333333',
        classroom_id: '44444444-4444-4444-8444-444444444444',
        channel_id: '55555555-5555-4555-8555-555555555555',
        occurrence_start_at: '2026-03-16T10:00:00.000Z',
        rating: 5,
        comment: null,
        submitted_at: '2026-03-16T10:01:00.000Z',
      },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(createActiveClassroomChain())
      .mockReturnValueOnce(activityChain)
      .mockReturnValueOnce(messageChain)
      .mockReturnValueOnce(membershipChain)
      .mockReturnValueOnce(scheduleChain)
      .mockReturnValueOnce(upsertChain);

    await submitActivityFeedFeedback({
      orgId: 'org-1',
      classSessionId: '33333333-3333-4333-8333-333333333333',
      classroomId: '44444444-4444-4444-8444-444444444444',
      channelId: '55555555-5555-4555-8555-555555555555',
      sourceEventId: '11111111-1111-4111-8111-111111111111',
      messageId: '22222222-2222-4222-8222-222222222222',
      occurrenceStartAt: '2026-03-16T10:00:00.000Z',
      rating: 5,
      comment: null,
      recipientProfileId: 'profile-1',
    });

    expect(mockFrom).toHaveBeenNthCalledWith(3, 'messages');
    expect(mockFrom).toHaveBeenNthCalledWith(4, 'channel_members');
    expect(mockFrom).toHaveBeenNthCalledWith(5, 'class_schedules');
  });

  it('throws when the session is missing', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(
      submitActivityFeedFeedback({
        orgId: 'org-1',
        classSessionId: '33333333-3333-4333-8333-333333333333',
        classroomId: '44444444-4444-4444-8444-444444444444',
        channelId: '55555555-5555-4555-8555-555555555555',
        sourceEventId: '11111111-1111-4111-8111-111111111111',
        rating: 5,
      }),
    ).rejects.toThrow('Not authenticated');
  });

  it('throws when the activity lookup does not find a matching item', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });

    const activityChain = createMaybeSingleChain({
      data: null,
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(createActiveClassroomChain())
      .mockReturnValueOnce(activityChain);

    await expect(
      submitActivityFeedFeedback({
        orgId: 'org-1',
        classSessionId: '33333333-3333-4333-8333-333333333333',
        classroomId: '44444444-4444-4444-8444-444444444444',
        channelId: '55555555-5555-4555-8555-555555555555',
        sourceEventId: '11111111-1111-4111-8111-111111111111',
        rating: 5,
        recipientProfileId: 'profile-1',
      }),
    ).rejects.toThrow('Activity not found');
  });

  it('rejects post-archive classroom feedback', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });

    mockFrom.mockReturnValueOnce(
      createMaybeSingleChain({
        data: {
          status: 'archived',
          archived_at: '2026-03-15T00:00:00.000Z',
        },
        error: null,
      }),
    );

    await expect(
      submitActivityFeedFeedback({
        orgId: 'org-1',
        classSessionId: '33333333-3333-4333-8333-333333333333',
        classroomId: '44444444-4444-4444-8444-444444444444',
        channelId: '55555555-5555-4555-8555-555555555555',
        sourceEventId: '11111111-1111-4111-8111-111111111111',
        occurrenceStartAt: '2026-03-16T10:00:00.000Z',
        rating: 5,
        recipientProfileId: 'profile-1',
      }),
    ).rejects.toThrow('Archived classrooms cannot receive feedback');
  });

  it('resolves a schedule id from source_session_id before writing', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });

    const activityChain = createMaybeSingleChain({
      data: { id: 'activity-1' },
      error: null,
    });
    const scheduleChain = createMaybeSingleChain({
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        source_session_id: '21212183-7e98-4669-a403-81a6b1ad1bb0',
      },
      error: null,
    });
    const upsertChain = createUpsertSingleChain({
      data: {
        source_event_id: '11111111-1111-4111-8111-111111111111',
        message_id: null,
        class_session_id: '33333333-3333-4333-8333-333333333333',
        classroom_id: '44444444-4444-4444-8444-444444444444',
        channel_id: '55555555-5555-4555-8555-555555555555',
        occurrence_start_at: '2026-03-16T10:00:00.000Z',
        rating: 5,
        comment: null,
        submitted_at: '2026-03-16T10:01:00.000Z',
      },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(createActiveClassroomChain())
      .mockReturnValueOnce(activityChain)
      .mockReturnValueOnce(scheduleChain)
      .mockReturnValueOnce(upsertChain);

    await submitActivityFeedFeedback({
      orgId: 'org-1',
      classSessionId: '21212183-7e98-4669-a403-81a6b1ad1bb0',
      classroomId: '44444444-4444-4444-8444-444444444444',
      channelId: '55555555-5555-4555-8555-555555555555',
      sourceEventId: '11111111-1111-4111-8111-111111111111',
      occurrenceStartAt: '2026-03-16T10:00:00.000Z',
      rating: 5,
      comment: null,
      recipientProfileId: 'profile-1',
    });

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        class_session_id: '33333333-3333-4333-8333-333333333333',
      }),
      { onConflict: 'org_id,recipient_profile_id,class_session_id' },
    );
  });
});
