import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildActivityFeedForProfile } from '@iconicedu/web/lib/activity-feed/builders/activity-feed.builder';

const getActivityFeedItemsByOrg = vi.fn();
const getActivityFeedGroupMembersByGroupIds = vi.fn();
const getProfilesByIds = vi.fn();
const buildUserProfileFromRow = vi.fn();

vi.mock('@iconicedu/web/lib/activity-feed/queries/activity-feed.query', () => ({
  getActivityFeedItemsByOrg: (...args: unknown[]) => getActivityFeedItemsByOrg(...args),
  getActivityFeedGroupMembersByGroupIds: (...args: unknown[]) =>
    getActivityFeedGroupMembersByGroupIds(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfilesByIds: (...args: unknown[]) => getProfilesByIds(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileFromRow: (...args: unknown[]) => buildUserProfileFromRow(...args),
}));

describe('buildActivityFeedForProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActivityFeedGroupMembersByGroupIds.mockResolvedValue({ data: [] });
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

  it('sorts grouped sub-activities from most recent to oldest', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'group-1',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'group',
          occurred_at: '2026-03-07T16:00:00.000Z',
          created_at: '2026-03-07T16:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'session.started',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Class session' } },
          sub_activity_count: 2,
          updated_at: '2026-03-07T16:00:00.000Z',
        },
        {
          id: 'item-old',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T14:00:00.000Z',
          created_at: '2026-03-07T14:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'session.started',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Older item' } },
          updated_at: '2026-03-07T14:00:00.000Z',
        },
        {
          id: 'item-new',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:00:00.000Z',
          created_at: '2026-03-07T15:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'session.ended',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Newer item' } },
          updated_at: '2026-03-07T15:00:00.000Z',
        },
      ],
    });
    getActivityFeedGroupMembersByGroupIds.mockResolvedValue({
      data: [
        { group_id: 'group-1', item_id: 'item-old' },
        { group_id: 'group-1', item_id: 'item-new' },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');
    const todayItems = feed.sections[0]?.items ?? [];
    const group = todayItems.find((item) => item.kind === 'group');
    if (!group || group.kind !== 'group') {
      throw new Error('Expected grouped item');
    }

    expect(group.subActivities?.items.map((item) => item.ids.id)).toEqual([
      'item-new',
      'item-old',
    ]);
  });

  it('shows all grouped leaf items even when one matches the parent headline', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'group-2',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'group',
          occurred_at: '2026-03-07T16:00:00.000Z',
          created_at: '2026-03-07T16:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'class.updated',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: {
              primary: 'Class updated',
              secondary: 'Math Foundations',
            },
          },
          sub_activity_count: 2,
          updated_at: '2026-03-07T16:00:00.000Z',
        },
        {
          id: 'item-duplicate-parent',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:50:00.000Z',
          created_at: '2026-03-07T15:50:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'class.updated',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: {
              primary: 'Class updated',
              secondary: 'Math Foundations',
            },
          },
          updated_at: '2026-03-07T15:50:00.000Z',
        },
        {
          id: 'item-actual-child',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:55:00.000Z',
          created_at: '2026-03-07T15:55:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'session.scheduled',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: { primary: 'Session scheduled', secondary: 'Math Foundations' },
          },
          updated_at: '2026-03-07T15:55:00.000Z',
        },
      ],
    });
    getActivityFeedGroupMembersByGroupIds.mockResolvedValue({
      data: [
        { group_id: 'group-2', item_id: 'item-duplicate-parent' },
        { group_id: 'group-2', item_id: 'item-actual-child' },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');
    const group = feed.sections[0]?.items.find((item) => item.kind === 'group');
    if (!group || group.kind !== 'group') {
      throw new Error('Expected grouped item');
    }

    expect(group.subActivities?.items.map((item) => item.ids.id)).toEqual([
      'item-actual-child',
      'item-duplicate-parent',
    ]);
  });

  it('keeps class created as the parent and shows one grouped participants-added subactivity', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'group-members-1',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'group',
          occurred_at: '2026-03-07T16:00:00.000Z',
          created_at: '2026-03-07T16:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'member.invited',
          actor_profile_id: 'actor-1',
          refs: {},
          group_key: 'class-created:space-1',
          group_type: 'class',
          content: {
            headline: {
              primary: 'Tehara Morgan added',
              secondary: 'Math Foundations',
            },
            leading: {
              kind: 'avatars',
              avatars: [
                {
                  name: 'Tehara Morgan',
                  avatar: { source: 'seed', seed: 'tehara' },
                  themeKey: 'rose',
                },
              ],
              overflowCount: 0,
            },
          },
          sub_activity_count: 3,
          updated_at: '2026-03-07T16:00:00.000Z',
        },
        {
          id: 'invite-2',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:55:00.000Z',
          created_at: '2026-03-07T15:55:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'member.invited',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: { primary: 'Riley Morgan added', secondary: 'Math Foundations' },
            leading: {
              kind: 'avatars',
              avatars: [
                {
                  name: 'Riley Morgan',
                  avatar: { source: 'seed', seed: 'riley' },
                  themeKey: 'emerald',
                },
              ],
              overflowCount: 0,
            },
          },
          updated_at: '2026-03-07T15:55:00.000Z',
        },
        {
          id: 'class-created-child',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:52:00.000Z',
          created_at: '2026-03-07T15:52:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'class.created',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: {
              primary: 'Class created',
              secondary: 'Math Foundations',
            },
            summary: 'Math class created. First session Mar 8 at 2:00 PM.',
          },
          updated_at: '2026-03-07T15:52:00.000Z',
        },
        {
          id: 'invite-3',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:50:00.000Z',
          created_at: '2026-03-07T15:50:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'member.invited',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: { primary: 'Alex Stone added', secondary: 'Math Foundations' },
            leading: {
              kind: 'avatars',
              avatars: [
                {
                  name: 'Alex Stone',
                  avatar: { source: 'seed', seed: 'alex' },
                  themeKey: 'blue',
                },
              ],
              overflowCount: 0,
            },
          },
          updated_at: '2026-03-07T15:50:00.000Z',
        },
      ],
    });
    getActivityFeedGroupMembersByGroupIds.mockResolvedValue({
      data: [
        { group_id: 'group-members-1', item_id: 'invite-2' },
        { group_id: 'group-members-1', item_id: 'class-created-child' },
        { group_id: 'group-members-1', item_id: 'invite-3' },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');
    const group = feed.sections[0]?.items.find((item) => item.kind === 'group');
    if (!group || group.kind !== 'group') {
      throw new Error('Expected grouped item');
    }

    expect(group.content.headline.primary).toBe('Class created');
    expect(group.subActivities?.items).toHaveLength(1);
    expect(group.subActivities?.items[0]).toMatchObject({
      verb: 'members.invited',
      metadata: {
        readItemIds: expect.arrayContaining(['group-members-1', 'invite-2', 'invite-3']),
      },
      content: {
        headline: { primary: '3 participants added' },
        summary:
          'Added: Tehara Morgan, Riley Morgan, Alex Stone. Added to Math Foundations.',
        leading: {
          kind: 'avatars',
          avatars: [
            {
              name: 'Tehara Morgan',
              avatar: { source: 'seed', seed: 'tehara' },
              themeKey: 'rose',
            },
            {
              name: 'Riley Morgan',
              avatar: { source: 'seed', seed: 'riley' },
              themeKey: 'emerald',
            },
            {
              name: 'Alex Stone',
              avatar: { source: 'seed', seed: 'alex' },
              themeKey: 'blue',
            },
          ],
          overflowCount: 0,
        },
      },
    });
    expect(feed.unreadCount).toBe(1);
  });

  it('updates grouped DM parent headline with sender and direct message count', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'group-dm-1',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'group',
          occurred_at: '2026-03-07T16:00:00.000Z',
          created_at: '2026-03-07T16:00:00.000Z',
          tab_key: 'all',
          audience: {
            scope: { kind: 'channel', channelId: 'channel-dm-1' },
            visibility: 'scope_only',
          },
          verb: 'dms.posted',
          actor_profile_id: 'actor-1',
          refs: {},
          group_key: 'dm-posted:channel-dm-1:2026-03-07T16',
          group_type: 'message',
          content: {
            headline: {
              primary: 'Sender sent you direct messages',
              secondary: 'Priya + Riley',
            },
          },
          sub_activity_count: 2,
          updated_at: '2026-03-07T16:00:00.000Z',
        },
        {
          id: 'dm-item-1',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:59:00.000Z',
          created_at: '2026-03-07T15:59:00.000Z',
          tab_key: 'all',
          audience: {
            scope: { kind: 'channel', channelId: 'channel-dm-1' },
            visibility: 'scope_only',
          },
          verb: 'dm.posted',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: {
              primary: 'Sender sent you a direct message',
              secondary: 'Priya + Riley',
            },
          },
          updated_at: '2026-03-07T15:59:00.000Z',
        },
        {
          id: 'dm-item-2',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:58:00.000Z',
          created_at: '2026-03-07T15:58:00.000Z',
          tab_key: 'all',
          audience: {
            scope: { kind: 'channel', channelId: 'channel-dm-1' },
            visibility: 'scope_only',
          },
          verb: 'dm.posted',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: {
              primary: 'Sender sent you a direct message',
              secondary: 'Priya + Riley',
            },
          },
          updated_at: '2026-03-07T15:58:00.000Z',
        },
      ],
    });
    getActivityFeedGroupMembersByGroupIds.mockResolvedValue({
      data: [
        { group_id: 'group-dm-1', item_id: 'dm-item-1' },
        { group_id: 'group-dm-1', item_id: 'dm-item-2' },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');
    const group = feed.sections[0]?.items.find((item) => item.kind === 'group');
    if (!group || group.kind !== 'group') {
      throw new Error('Expected grouped item');
    }

    expect(group.content.headline.primary).toBe('Educator sent you 2 direct messages');
    expect(group.content.headline.secondary).toBe('Priya + Riley');
  });

  it('keeps DM parent count based on dm.posted leaves when reaction leaves are present', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'group-dm-2',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'group',
          occurred_at: '2026-03-07T16:00:00.000Z',
          created_at: '2026-03-07T16:00:00.000Z',
          tab_key: 'all',
          audience: {
            scope: { kind: 'channel', channelId: 'channel-dm-1' },
            visibility: 'scope_only',
          },
          verb: 'dms.posted',
          actor_profile_id: 'actor-1',
          refs: {},
          group_key: 'dm-posted:channel-dm-1:2026-03-07T16',
          group_type: 'message',
          content: {
            headline: {
              primary: 'Sender sent you direct messages',
              secondary: 'Priya + Riley',
            },
          },
          sub_activity_count: 3,
          updated_at: '2026-03-07T16:00:00.000Z',
        },
        {
          id: 'dm-item-msg-1',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:59:00.000Z',
          created_at: '2026-03-07T15:59:00.000Z',
          tab_key: 'all',
          audience: {
            scope: { kind: 'channel', channelId: 'channel-dm-1' },
            visibility: 'scope_only',
          },
          verb: 'dm.posted',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: {
              primary: 'Sender sent you a direct message',
              secondary: 'Priya + Riley',
            },
          },
          updated_at: '2026-03-07T15:59:00.000Z',
        },
        {
          id: 'dm-item-msg-2',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:58:00.000Z',
          created_at: '2026-03-07T15:58:00.000Z',
          tab_key: 'all',
          audience: {
            scope: { kind: 'channel', channelId: 'channel-dm-1' },
            visibility: 'scope_only',
          },
          verb: 'dm.posted',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: {
              primary: 'Sender sent you a direct message',
              secondary: 'Priya + Riley',
            },
          },
          updated_at: '2026-03-07T15:58:00.000Z',
        },
        {
          id: 'dm-item-reaction',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T15:57:00.000Z',
          created_at: '2026-03-07T15:57:00.000Z',
          tab_key: 'all',
          audience: {
            scope: { kind: 'channel', channelId: 'channel-dm-1' },
            visibility: 'scope_only',
          },
          verb: 'dm.reaction.added',
          actor_profile_id: 'actor-1',
          refs: {},
          content: {
            headline: {
              primary: 'Sender reacted 👍 to your direct message',
              secondary: 'Priya + Riley',
            },
          },
          updated_at: '2026-03-07T15:57:00.000Z',
        },
      ],
    });
    getActivityFeedGroupMembersByGroupIds.mockResolvedValue({
      data: [
        { group_id: 'group-dm-2', item_id: 'dm-item-msg-1' },
        { group_id: 'group-dm-2', item_id: 'dm-item-msg-2' },
        { group_id: 'group-dm-2', item_id: 'dm-item-reaction' },
      ],
    });

    const feed = await buildActivityFeedForProfile({} as never, 'org-1', 'profile-1');
    const group = feed.sections[0]?.items.find((item) => item.kind === 'group');
    if (!group || group.kind !== 'group') {
      throw new Error('Expected grouped item');
    }

    expect(group.content.headline.primary).toBe('Educator sent you 2 direct messages');
  });

  it('attaches persisted recipient feedback metadata to feedback request activities', async () => {
    getActivityFeedItemsByOrg.mockResolvedValue({
      data: [
        {
          id: 'feedback-item-1',
          org_id: 'org-1',
          recipient_profile_id: 'profile-1',
          source_event_id: 'event-feedback-1',
          kind: 'leaf',
          occurred_at: '2026-03-07T16:00:00.000Z',
          created_at: '2026-03-07T16:00:00.000Z',
          tab_key: 'classes',
          audience: {
            scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
            visibility: 'scope_only',
          },
          verb: 'session.feedback_request.sent',
          actor_profile_id: 'actor-1',
          refs: {},
          content: { headline: { primary: 'Class feedback requested' } },
          metadata: {
            classSessionId: 'schedule-1',
          },
          updated_at: '2026-03-07T16:00:00.000Z',
        },
      ],
    });

    const feedbackSelectChain = {
      eq: vi.fn(() => feedbackSelectChain),
      in: vi.fn(() => feedbackSelectChain),
      is: vi.fn(() => feedbackSelectChain),
      returns: vi.fn(async () => ({
        data: [
          {
            source_event_id: 'event-feedback-1',
            class_session_id: 'schedule-1',
            message_id: 'message-feedback-1',
            rating: 4,
            comment: 'Need slower pacing',
            submitted_at: '2026-03-07T16:05:00.000Z',
          },
        ],
        error: null,
      })),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table !== 'message_session_feedback') {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: vi.fn(() => feedbackSelectChain),
        };
      }),
    } as never;

    const feed = await buildActivityFeedForProfile(supabase, 'org-1', 'profile-1');
    const activity = feed.sections[0]?.items[0];
    expect(activity?.metadata?.feedbackResponse).toMatchObject({
      sourceEventId: 'event-feedback-1',
      classSessionId: 'schedule-1',
      messageId: 'message-feedback-1',
      rating: 4,
      comment: 'Need slower pacing',
    });
  });
});
