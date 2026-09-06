import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildActivityFeedForProfile } from '@iconicedu/web/lib/activity-feed/builders/activity-feed.builder';

const getActivityFeedItemsByOrg = vi.fn();
const listSessionCompletions = vi.fn();
const getProfilesByIds = vi.fn();
const buildUserProfileFromRow = vi.fn();

vi.mock('@iconicedu/web/lib/activity-feed/queries/activity-feed.query', () => ({
  getActivityFeedItemsByOrg: (...args: unknown[]) => getActivityFeedItemsByOrg(...args),
}));

vi.mock('@iconicedu/web/lib/api/session-completions', () => ({
  listSessionCompletions: (...args: unknown[]) => listSessionCompletions(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: (...args: unknown[]) => getProfilesByIds(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileFromRow: (...args: unknown[]) => buildUserProfileFromRow(...args),
}));

function completion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'completion-1',
    orgId: 'org-1',
    scheduleId: 'schedule-1',
    occurrenceKey: '2026-03-03T11:00:00.000Z',
    profileId: 'profile-1',
    role: 'guardian',
    status: 'confirmed',
    disputeCategory: null,
    disputeReason: null,
    rescheduleRequested: false,
    rating: null,
    ratingComment: null,
    channelId: 'channel-1',
    learningSpaceId: 'space-1',
    sessionTitle: 'Algebra I',
    sessionEndAt: '2026-03-03T12:00:00.000Z',
    notifiedAt: '2026-03-03T12:00:00.000Z',
    confirmedAt: '2026-03-03T12:10:00.000Z',
    disputedAt: null,
    ratedAt: null,
    resolvedAt: '2026-03-03T12:10:00.000Z',
    expiresAt: '2026-03-06T12:00:00.000Z',
    ...overrides,
  };
}

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
    listSessionCompletions.mockResolvedValue({
      items: [],
      nextCursor: null,
      total: null,
    });
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

  it('hydrates saved ratings for feedback request activity items', async () => {
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
    listSessionCompletions.mockResolvedValue({
      items: [
        completion({
          rating: 4,
          ratingComment: 'Helpful pacing',
          ratedAt: '2026-03-03T12:10:00.000Z',
        }),
      ],
      nextCursor: null,
      total: null,
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');

    expect(listSessionCompletions).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'org-1',
      profileId: 'profile-1',
      limit: 50,
    });
    expect(feed.sections[0]?.items[0]).toMatchObject({
      verb: 'session.feedback_request.sent',
      metadata: {
        sessionCompletion: {
          id: 'completion-1',
          scheduleId: 'schedule-1',
          channelId: 'channel-1',
          occurrenceKey: '2026-03-03T11:00:00.000Z',
          rating: 4,
          ratingComment: 'Helpful pacing',
          ratedAt: '2026-03-03T12:10:00.000Z',
        },
      },
    });
  });

  it('hydrates session completions for single completion checks', async () => {
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
    listSessionCompletions.mockResolvedValue({
      items: [completion()],
      nextCursor: null,
      total: null,
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');

    expect(listSessionCompletions).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'org-1',
      profileId: 'profile-1',
      limit: 50,
    });
    expect(feed.sections[0]?.items[0]).toMatchObject({
      verb: 'session.completion_check.sent',
      metadata: {
        sessionCompletion: {
          id: 'completion-1',
          scheduleId: 'schedule-1',
          occurrenceKey: '2026-03-03T11:00:00.000Z',
          profileId: 'profile-1',
          role: 'guardian',
          status: 'confirmed',
          disputeCategory: null,
          disputeReason: null,
          rescheduleRequested: false,
          confirmedAt: '2026-03-03T12:10:00.000Z',
        },
      },
    });
  });

  it('hydrates session completions into batch completion check sessions by occurrence', async () => {
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
    listSessionCompletions.mockResolvedValue({
      items: [
        completion({
          occurrenceKey: '2026-03-04T11:00:00.000Z',
          confirmedAt: '2026-03-04T12:10:00.000Z',
        }),
      ],
      nextCursor: null,
      total: null,
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');
    const item = feed.sections[0]?.items[0];
    const sessions = (item?.metadata as { sessions?: Array<Record<string, unknown>> })
      ?.sessions;

    expect(listSessionCompletions).toHaveBeenCalledWith(expect.anything(), {
      orgId: 'org-1',
      profileId: 'profile-1',
      limit: 50,
    });
    expect(sessions?.[0]?.sessionCompletion).toBeUndefined();
    expect(sessions?.[1]?.sessionCompletion).toMatchObject({
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
