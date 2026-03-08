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

  it('does not repeat parent item as a child activity', async () => {
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
            headline: { primary: 'Class updated', secondary: 'Math Foundations' },
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
            headline: { primary: 'Class updated', secondary: 'Math Foundations' },
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
    ]);
  });
});
