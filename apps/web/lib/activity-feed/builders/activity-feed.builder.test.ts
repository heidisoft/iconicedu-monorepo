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
          content: { headline: { primary: 'Learning space created' } },
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
          content: { headline: { primary: 'Unread learning space item' } },
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
      { key: 'classes', label: 'Learning spaces', badgeCount: 1 },
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
          content: { headline: { primary: 'Learning space session' } },
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
            headline: {
              primary: 'Learning space updated',
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
              primary: 'Learning space updated',
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
    ]);
  });

  it('keeps learning space created as the parent and shows one grouped participants-added subactivity', async () => {
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
              primary: 'Learning space created',
              secondary: 'Math Foundations',
            },
            summary: 'Math learning space created. First session Mar 8 at 2:00 PM.',
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

    expect(group.content.headline.primary).toBe('Learning space created');
    expect(group.subActivities?.items).toHaveLength(1);
    expect(group.subActivities?.items[0]).toMatchObject({
      verb: 'members.invited',
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
  });
});
