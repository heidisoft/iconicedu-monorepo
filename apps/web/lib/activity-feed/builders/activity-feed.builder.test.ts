import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildActivityFeedForProfile } from '@iconicedu/web/lib/activity-feed/builders/activity-feed.builder';

const getActivityFeedItemsByOrg = vi.fn();
const getClassSessionFeedbackByProfileAndSessions = vi.fn();
const getClassSessionCompletionVotesByProfileAndTargets = vi.fn();
const getProfilesByIds = vi.fn();
const buildUserProfileFromRow = vi.fn();
const createSupabaseServiceClient = vi.fn();

vi.mock('@iconicedu/web/lib/activity-feed/queries/activity-feed.query', () => ({
  getActivityFeedItemsByOrg: (...args: unknown[]) => getActivityFeedItemsByOrg(...args),
  getClassSessionFeedbackByProfileAndSessions: (...args: unknown[]) =>
    getClassSessionFeedbackByProfileAndSessions(...args),
  getClassSessionCompletionVotesByProfileAndTargets: (...args: unknown[]) =>
    getClassSessionCompletionVotesByProfileAndTargets(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: (...args: unknown[]) => getProfilesByIds(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileFromRow: (...args: unknown[]) => buildUserProfileFromRow(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => createSupabaseServiceClient(),
}));

describe('buildActivityFeedForProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfilesByIds.mockResolvedValue({
      data: [{ id: 'actor-1', kind: 'educator', account_id: 'account-1' }],
    });
    buildUserProfileFromRow.mockResolvedValue({
      ids: { id: 'actor-1', orgId: 'org-1', accountId: 'account-1' },
      kind: 'educator',
      profile: {
        displayName: 'Educator',
        avatar: { source: 'generated', seed: 'actor-1' },
      },
    });
    getClassSessionFeedbackByProfileAndSessions.mockResolvedValue({ data: [] });
    getClassSessionCompletionVotesByProfileAndTargets.mockResolvedValue({ data: [] });
    createSupabaseServiceClient.mockReturnValue({ from: vi.fn() });
  });

  it('requests inbox rows scoped to the current recipient profile', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'item-1',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-03T12:00:00.000Z',
          created_at: '2026-03-03T12:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'class.created',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Class created' } },
          updated_at: '2026-03-03T12:00:00.000Z',
        },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');

    expect(getActivityFeedItemsByOrg).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'profile-1',
    );
    expect(feed.sections).toHaveLength(1);
    expect(feed.sections[0]?.items[0]?.ids.id).toBe('item-1');
  });

  it('hydrates saved feedback responses for feedback request activity items', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'feedback-item',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          source_event_id: 'event-1',
          kind: 'leaf',
          occurred_at: '2026-03-03T12:00:00.000Z',
          created_at: '2026-03-03T12:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'session.feedback_request.sent',
          actor_profile_id: null,
          refs: {},
          content: { headline: { primary: 'Share feedback for Algebra I' } },
          metadata: {
            sourceEventId: 'event-1',
            scheduleId: 'schedule-1',
            occurrenceStart: '2026-03-03T11:00:00.000Z',
            learningSpaceId: 'space-1',
            channelId: 'channel-1',
            feedbackUiEnabled: true,
          },
          updated_at: '2026-03-03T12:00:00.000Z',
        },
      ],
    });
    getClassSessionFeedbackByProfileAndSessions.mockResolvedValue({
      data: [
        {
          source_event_id: 'event-old',
          message_id: null,
          class_session_id: 'schedule-1',
          classroom_id: 'space-1',
          channel_id: 'channel-1',
          occurrence_start_at: '2026-03-02T11:00:00.000Z',
          rating: 2,
          comment: 'Different occurrence',
          submitted_at: '2026-03-02T12:10:00.000Z',
        },
        {
          source_event_id: 'event-1',
          message_id: null,
          class_session_id: 'schedule-1',
          classroom_id: 'space-1',
          channel_id: 'channel-1',
          occurrence_start_at: '2026-03-03T11:00:00.000Z',
          rating: 4,
          comment: 'Helpful pacing',
          submitted_at: '2026-03-03T12:10:00.000Z',
        },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');

    expect(getClassSessionFeedbackByProfileAndSessions).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'profile-1',
      ['schedule-1'],
    );
    expect(feed.sections[0]?.items[0]).toMatchObject({
      verb: 'session.feedback_request.sent',
      metadata: {
        feedbackResponse: {
          sourceEventId: 'event-1',
          messageId: null,
          classSessionId: 'schedule-1',
          classroomId: 'space-1',
          channelId: 'channel-1',
          occurrenceStartAt: '2026-03-03T11:00:00.000Z',
          rating: 4,
          comment: 'Helpful pacing',
          submittedAt: '2026-03-03T12:10:00.000Z',
        },
      },
    });
  });

  it('hydrates saved completion votes for single completion checks', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'completion-item',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          source_event_id: 'event-1',
          kind: 'leaf',
          occurred_at: '2026-03-03T12:00:00.000Z',
          created_at: '2026-03-03T12:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'session.completion_check.sent',
          actor_profile_id: null,
          refs: {},
          content: { headline: { primary: 'Confirm your lesson' } },
          metadata: {
            scheduleId: 'schedule-1',
            occurrenceStart: '2026-03-03T11:00:00.000Z',
            learningSpaceId: 'space-1',
            channelId: 'channel-1',
            completionCheckUiEnabled: true,
          },
          updated_at: '2026-03-03T12:00:00.000Z',
        },
      ],
    });
    getClassSessionCompletionVotesByProfileAndTargets.mockResolvedValue({
      data: [
        {
          schedule_id: 'schedule-1',
          occurrence_key: '2026-03-03T11:00:00+00:00',
          profile_id: 'profile-1',
          role: 'guardian',
          status: 'confirmed',
          dispute_category: null,
          dispute_reason: null,
          reschedule_requested: false,
          voted_at: '2026-03-03T12:10:00.000Z',
        },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');

    expect(createSupabaseServiceClient).toHaveBeenCalledTimes(1);
    expect(getClassSessionCompletionVotesByProfileAndTargets).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'profile-1',
      ['schedule-1'],
      ['2026-03-03T11:00:00.000Z'],
    );
    expect(feed.sections[0]?.items[0]).toMatchObject({
      verb: 'session.completion_check.sent',
      metadata: {
        completionVote: {
          scheduleId: 'schedule-1',
          occurrenceKey: '2026-03-03T11:00:00.000Z',
          profileId: 'profile-1',
          role: 'guardian',
          status: 'confirmed',
          disputeCategory: null,
          disputeReason: null,
          rescheduleRequested: false,
          votedAt: '2026-03-03T12:10:00.000Z',
        },
      },
    });
  });

  it('hydrates saved completion votes into batch completion check sessions by occurrence', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'completion-batch-item',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          source_event_id: 'event-1',
          kind: 'leaf',
          occurred_at: '2026-03-03T12:00:00.000Z',
          created_at: '2026-03-03T12:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'session.completion_check.batch.sent',
          actor_profile_id: null,
          refs: {},
          content: { headline: { primary: 'Confirm your lessons' } },
          metadata: {
            sessions: [
              {
                scheduleId: 'schedule-1',
                occurrenceStart: '2026-03-03T11:00:00.000Z',
                title: 'Math Foundations',
                channelId: 'channel-1',
                learningSpaceId: 'space-1',
              },
              {
                scheduleId: 'schedule-1',
                occurrenceStart: '2026-03-04T11:00:00.000Z',
                title: 'Math Foundations',
                channelId: 'channel-1',
                learningSpaceId: 'space-1',
              },
            ],
          },
          updated_at: '2026-03-03T12:00:00.000Z',
        },
      ],
    });
    getClassSessionCompletionVotesByProfileAndTargets.mockResolvedValue({
      data: [
        {
          schedule_id: 'schedule-1',
          occurrence_key: '2026-03-04T11:00:00+00:00',
          profile_id: 'profile-1',
          role: 'guardian',
          status: 'confirmed',
          dispute_category: null,
          dispute_reason: null,
          reschedule_requested: false,
          voted_at: '2026-03-04T12:10:00.000Z',
        },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');
    const item = feed.sections[0]?.items[0];
    const sessions = (item?.metadata as { sessions?: Array<Record<string, unknown>> })
      ?.sessions;

    expect(getClassSessionCompletionVotesByProfileAndTargets).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'profile-1',
      ['schedule-1'],
      ['2026-03-03T11:00:00.000Z', '2026-03-04T11:00:00.000Z'],
    );
    expect(sessions?.[0]?.completionVote).toBeUndefined();
    expect(sessions?.[1]?.completionVote).toMatchObject({
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-03-04T11:00:00.000Z',
      status: 'confirmed',
    });
  });

  it('builds tab badge counts from unread items', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'item-unread',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-03T12:00:00.000Z',
          created_at: '2026-03-03T12:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'class.created',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Unread class item' } },
          is_read: false,
          updated_at: '2026-03-03T12:00:00.000Z',
        },
        {
          id: 'item-read',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-03T13:00:00.000Z',
          created_at: '2026-03-03T13:00:00.000Z',
          tab_key: 'payment',
          audience: { scope: { kind: 'global' }, visibility: 'public' },
          verb: 'payment.received',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Read payment item' } },
          is_read: true,
          updated_at: '2026-03-03T13:00:00.000Z',
        },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');

    expect(feed.tabs).toEqual([
      { key: 'all', label: 'All', badgeCount: 1 },
      { key: 'classes', label: 'Classes', badgeCount: 1 },
      { key: 'payment', label: 'Payment', badgeCount: 0 },
      { key: 'system', label: 'System', badgeCount: 0 },
    ]);
    expect(feed.unreadCount).toBe(1);
  });

  it('splits sections into Today, Yesterday, This week and Earlier', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00.000Z'));
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'today-item',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-11T09:00:00.000Z',
          created_at: '2026-03-11T09:00:00.000Z',
          tab_key: 'classes',
          audience: { scope: { kind: 'global' }, visibility: 'public' },
          verb: 'class.created',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Today item' } },
          updated_at: '2026-03-11T09:00:00.000Z',
        },
        {
          id: 'yesterday-item',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-10T09:00:00.000Z',
          created_at: '2026-03-10T09:00:00.000Z',
          tab_key: 'classes',
          audience: { scope: { kind: 'global' }, visibility: 'public' },
          verb: 'class.created',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Yesterday item' } },
          updated_at: '2026-03-10T09:00:00.000Z',
        },
        {
          id: 'this-week-item',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-08T09:00:00.000Z',
          created_at: '2026-03-08T09:00:00.000Z',
          tab_key: 'classes',
          audience: { scope: { kind: 'global' }, visibility: 'public' },
          verb: 'class.created',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'This week item' } },
          updated_at: '2026-03-08T09:00:00.000Z',
        },
        {
          id: 'earlier-item',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-02-20T09:00:00.000Z',
          created_at: '2026-02-20T09:00:00.000Z',
          tab_key: 'classes',
          audience: { scope: { kind: 'global' }, visibility: 'public' },
          verb: 'class.created',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Earlier item' } },
          updated_at: '2026-02-20T09:00:00.000Z',
        },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');

    expect(feed.sections.map((section) => section.label)).toEqual([
      'Today',
      'Yesterday',
      'This week',
      'Earlier',
    ]);
    vi.useRealTimers();
  });
});
