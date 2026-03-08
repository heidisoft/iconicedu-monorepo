import { describe, expect, it } from 'vitest';

import {
  getInitialGroupCollapsedState,
  groupHasUnreadSubActivities,
} from './activity-with-subitems';
import type {
  ActivityFeedGroupItemVM,
  ActivityFeedLeafItemVM,
} from '@iconicedu/shared-types';

function makeSubActivity(isRead: boolean): ActivityFeedLeafItemVM {
  return {
    kind: 'leaf',
    ids: { id: `leaf-${isRead ? 'read' : 'unread'}`, orgId: 'org-1' },
    timestamps: {
      occurredAt: '2026-03-04T12:00:00.000Z',
      createdAt: '2026-03-04T12:00:00.000Z',
    },
    tabKey: 'classes',
    audience: {
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      visibility: 'scope_only',
    },
    verb: 'homework.assigned',
    refs: { actor: {} as never },
    content: { headline: { primary: 'Sub activity' } },
    state: { isRead },
  };
}

describe('groupHasUnreadSubActivities', () => {
  it('returns true when any subactivity is unread', () => {
    expect(
      groupHasUnreadSubActivities([makeSubActivity(true), makeSubActivity(false)]),
    ).toBe(true);
  });

  it('returns false when all subactivities are read', () => {
    expect(
      groupHasUnreadSubActivities([makeSubActivity(true), makeSubActivity(true)]),
    ).toBe(false);
  });
});

describe('getInitialGroupCollapsedState', () => {
  it('defaults grouped inbox activities to expanded so subitems are visible', () => {
    const activity = {
      kind: 'group',
      ids: { id: 'group-1', orgId: 'org-1' },
      timestamps: {
        occurredAt: '2026-03-04T12:00:00.000Z',
        createdAt: '2026-03-04T12:00:00.000Z',
      },
      tabKey: 'classes',
      audience: {
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        visibility: 'scope_only',
      },
      verb: 'class.created',
      refs: { actor: {} as never },
      grouping: { groupKey: 'class-created:space-1', groupType: 'class' },
      content: { headline: { primary: 'Learning space created' } },
      subActivityCount: 2,
      subActivities: {
        items: [makeSubActivity(false), makeSubActivity(true)],
        total: 2,
      },
    } as ActivityFeedGroupItemVM;

    expect(getInitialGroupCollapsedState(activity)).toBe(false);
  });
});
