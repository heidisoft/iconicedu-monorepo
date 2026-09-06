import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { ActivityFeedQueryService } from '@iconicedu/api/modules/activity-feed/activity-feed-query.service';

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);
const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

function makeQuery<T>(rows: T[]) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    in: jest.fn(() => query),
    order: jest.fn(() => query),
    returns: jest.fn(async () => ({ data: rows, error: null })),
  };
  return query;
}

function makeAdminAuditQuery<T>(rows: T[]) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data: rows[0] ?? null, error: null })),
    returns: jest.fn(async () => ({ data: rows, error: null })),
  };
  return query;
}

describe('ActivityFeedQueryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hydrates saved ratings from session completions onto feedback requests', async () => {
    const activityRows = [
      {
        id: 'activity-1',
        org_id: 'org-1',
        recipient_profile_id: 'profile-1',
        source_event_id: 'event-1',
        kind: 'notification',
        occurred_at: '2026-05-05T12:00:00.000Z',
        created_at: '2026-05-05T12:00:00.000Z',
        tab_key: 'classes',
        audience: { scope: { kind: 'global' }, visibility: 'public' },
        verb: 'session.feedback_request.sent',
        actor_profile_id: null,
        refs: {},
        content: {
          headline: { primary: 'Share feedback for Algebra I' },
          summary: 'Tell us how the session went',
        },
        summary: 'Tell us how the session went',
        preview: null,
        action_button: null,
        expanded_content: null,
        importance: 'normal',
        is_read: false,
        read_at: null,
        dedupe_key: 'feedback-1',
        metadata: {
          sourceEventId: 'event-1',
          scheduleId: 'schedule-1',
          occurrenceStart: '2026-05-05T11:00:00.000Z',
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
          feedbackUiEnabled: true,
        },
        updated_at: '2026-05-05T12:00:00.000Z',
        deleted_at: null,
      },
    ];
    const completionRows = [
      {
        id: 'completion-1',
        org_id: 'org-1',
        schedule_id: 'schedule-1',
        occurrence_key: '2026-05-05T11:00:00+00:00',
        profile_id: 'profile-1',
        role: 'guardian',
        status: 'confirmed',
        dispute_category: null,
        dispute_reason: null,
        reschedule_requested: false,
        rating: 4,
        rating_comment: 'Helpful pacing',
        channel_id: 'channel-1',
        learning_space_id: 'space-1',
        session_title: 'Algebra I',
        session_end_at: '2026-05-05T12:00:00.000Z',
        notified_at: '2026-05-05T12:00:00.000Z',
        confirmed_at: '2026-05-05T12:05:00.000Z',
        disputed_at: null,
        rated_at: '2026-05-05T12:10:00.000Z',
        resolved_at: '2026-05-05T12:05:00.000Z',
        expires_at: '2026-05-08T12:00:00.000Z',
      },
    ];
    const activityQuery = makeQuery(activityRows);
    const completionQuery = makeQuery(completionRows);
    const sessionFrom = jest.fn((table: string) => {
      if (table === 'activity_feed_items') return activityQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    const serviceFrom = jest.fn((table: string) => {
      if (table === 'class_session_completions') return completionQuery;
      throw new Error(`Unexpected service table ${table}`);
    });
    createSupabaseSessionClientMock.mockReturnValue({ from: sessionFrom } as never);
    createSupabaseServiceClientMock.mockReturnValue({ from: serviceFrom } as never);

    const service = new ActivityFeedQueryService();
    const feed = await service.fetchFeed('token-1', 'org-1', 'profile-1');

    expect(completionQuery.in).toHaveBeenCalledWith('schedule_id', ['schedule-1']);
    expect(feed.sections[0]?.items[0]).toMatchObject({
      kind: 'leaf',
      verb: 'session.feedback_request.sent',
      metadata: {
        sessionCompletion: {
          id: 'completion-1',
          scheduleId: 'schedule-1',
          occurrenceKey: '2026-05-05T11:00:00.000Z',
          profileId: 'profile-1',
          status: 'confirmed',
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
          rating: 4,
          ratingComment: 'Helpful pacing',
          ratedAt: '2026-05-05T12:10:00.000Z',
        },
      },
    });
  });

  it('hydrates session completions onto completion check activity items', async () => {
    const activityRows = [
      {
        id: 'activity-1',
        org_id: 'org-1',
        recipient_profile_id: 'profile-1',
        source_event_id: 'event-1',
        kind: 'notification',
        occurred_at: '2026-05-05T12:00:00.000Z',
        created_at: '2026-05-05T12:00:00.000Z',
        tab_key: 'classes',
        audience: { scope: { kind: 'global' }, visibility: 'public' },
        verb: 'session.completion_check.sent',
        actor_profile_id: null,
        refs: {},
        content: {
          headline: { primary: 'Did Algebra I happen?' },
          summary: 'Confirm whether the class took place',
        },
        summary: 'Confirm whether the class took place',
        preview: null,
        action_button: null,
        expanded_content: null,
        importance: 'normal',
        is_read: false,
        read_at: null,
        dedupe_key: 'completion-1',
        metadata: {
          sourceEventId: 'event-1',
          scheduleId: 'schedule-1',
          occurrenceStart: '2026-05-05T11:00:00.000Z',
          learningSpaceId: 'space-1',
          channelId: 'channel-1',
          completionCheckUiEnabled: true,
        },
        updated_at: '2026-05-05T12:00:00.000Z',
        deleted_at: null,
      },
    ];
    const completionRows = [
      {
        id: 'completion-1',
        org_id: 'org-1',
        schedule_id: 'schedule-1',
        occurrence_key: '2026-05-05T11:00:00+00:00',
        profile_id: 'profile-1',
        role: 'guardian',
        status: 'disputed',
        dispute_category: 'teacher_absent',
        dispute_reason: 'Teacher did not join',
        reschedule_requested: true,
        rating: null,
        rating_comment: null,
        channel_id: 'channel-1',
        learning_space_id: 'space-1',
        session_title: 'Algebra I',
        session_end_at: '2026-05-05T12:00:00.000Z',
        notified_at: '2026-05-05T12:00:00.000Z',
        confirmed_at: null,
        disputed_at: '2026-05-05T12:10:00.000Z',
        rated_at: null,
        resolved_at: '2026-05-05T12:10:00.000Z',
        expires_at: '2026-05-08T12:00:00.000Z',
      },
    ];
    const activityQuery = makeQuery(activityRows);
    const completionQuery = makeQuery(completionRows);
    const sessionFrom = jest.fn((table: string) => {
      if (table === 'activity_feed_items') return activityQuery;
      throw new Error(`Unexpected session table ${table}`);
    });
    const serviceFrom = jest.fn((table: string) => {
      if (table === 'class_session_completions') return completionQuery;
      throw new Error(`Unexpected service table ${table}`);
    });
    createSupabaseSessionClientMock.mockReturnValue({ from: sessionFrom } as never);
    createSupabaseServiceClientMock.mockReturnValue({ from: serviceFrom } as never);

    const service = new ActivityFeedQueryService();
    const feed = await service.fetchFeed('token-1', 'org-1', 'profile-1');

    expect(completionQuery.in).toHaveBeenCalledWith('schedule_id', ['schedule-1']);
    expect(feed.sections[0]?.items[0]).toMatchObject({
      kind: 'leaf',
      verb: 'session.completion_check.sent',
      metadata: {
        sessionCompletion: {
          id: 'completion-1',
          scheduleId: 'schedule-1',
          occurrenceKey: '2026-05-05T11:00:00.000Z',
          profileId: 'profile-1',
          role: 'guardian',
          status: 'disputed',
          disputeCategory: 'teacher_absent',
          disputeReason: 'Teacher did not join',
          rescheduleRequested: true,
          disputedAt: '2026-05-05T12:10:00.000Z',
        },
      },
    });
  });

  it('allows staff to fetch the admin activity feed audit', async () => {
    const accountQuery = makeAdminAuditQuery([{ id: 'account-staff' }]);
    const rolesQuery = makeAdminAuditQuery([{ role_key: 'staff' }]);
    const activityQuery = makeAdminAuditQuery([]);
    const from = jest.fn((table: string) => {
      if (table === 'accounts') return accountQuery;
      if (table === 'user_roles') return rolesQuery;
      if (table === 'activity_feed_items') return activityQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    createSupabaseServiceClientMock.mockReturnValue({ from } as never);

    const service = new ActivityFeedQueryService();
    const audit = await service.fetchAdminActivityFeedAudit('auth-user-1', 'org-1');

    expect(rolesQuery.returns).toHaveBeenCalled();
    expect(audit).toMatchObject({
      totalCount: 0,
      unreadCount: 0,
      pipelineJobCount: 0,
      reminderJobCount: 0,
      verbSummaries: [],
      items: [],
    });
  });

  it('fetches unread badge count for the authenticated account in an org', async () => {
    const accountQuery = makeAdminAuditQuery([{ id: 'account-1' }]);
    const readStateQuery = makeAdminAuditQuery([
      { unread_count: 3 },
      { unread_count: 2 },
      { unread_count: -1 },
      { unread_count: null },
    ]);
    const from = jest.fn((table: string) => {
      if (table === 'accounts') return accountQuery;
      if (table === 'channel_read_state') return readStateQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    createSupabaseServiceClientMock.mockReturnValue({ from } as never);

    const service = new ActivityFeedQueryService();
    const result = await service.fetchUnreadBadgeCount('auth-user-1', 'org-1');

    expect(accountQuery.eq).toHaveBeenCalledWith('auth_user_id', 'auth-user-1');
    expect(accountQuery.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(readStateQuery.eq).toHaveBeenCalledWith('account_id', 'account-1');
    expect(result).toEqual({ unreadCount: 5 });
  });
});
