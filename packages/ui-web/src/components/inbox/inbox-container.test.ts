import { describe, expect, it } from 'vitest';

import type { ActivityFeedSectionVM } from '@iconicedu/shared-types';
import {
  applyReadStateToSections,
  buildUnreadTabCounts,
  resolveReadIdsForActivity,
  resolveUnreadIdsForTab,
} from './inbox-container';

const SECTIONS: ActivityFeedSectionVM[] = [
  {
    label: 'Today',
    items: [
      {
        kind: 'leaf',
        ids: { id: 'item-1', orgId: 'org-1' },
        timestamps: {
          occurredAt: '2026-03-03T12:00:00.000Z',
          createdAt: '2026-03-03T12:00:00.000Z',
        },
        tabKey: 'all',
        audience: { scope: { kind: 'global' }, visibility: 'public' },
        verb: 'message.posted',
        refs: { actor: null as never },
        content: { headline: { primary: 'Message posted' } },
        state: { isRead: false },
      },
      {
        kind: 'leaf',
        ids: { id: 'item-2', orgId: 'org-1' },
        timestamps: {
          occurredAt: '2026-03-03T13:00:00.000Z',
          createdAt: '2026-03-03T13:00:00.000Z',
        },
        tabKey: 'all',
        audience: { scope: { kind: 'global' }, visibility: 'public' },
        verb: 'message.posted',
        refs: { actor: null as never },
        content: { headline: { primary: 'Message posted' } },
        state: { isRead: true },
      },
    ],
  },
];

describe('applyReadStateToSections', () => {
  it('marks matching item ids read', () => {
    const next = applyReadStateToSections(SECTIONS, ['item-1']);

    expect(next[0]?.items[0]?.state?.isRead).toBe(true);
    expect(next[0]?.items[1]?.state?.isRead).toBe(true);
  });
});

describe('resolveReadIdsForActivity', () => {
  it('returns only the matched activity id and metadata read ids', () => {
    const sections: ActivityFeedSectionVM[] = [
      {
        label: 'Today',
        items: [
          {
            ...SECTIONS[0]!.items[0]!,
            metadata: { readItemIds: ['item-1-alias'] },
          },
        ],
      },
    ];

    expect(resolveReadIdsForActivity(sections, 'item-1')).toEqual([
      'item-1',
      'item-1-alias',
    ]);
  });
});

describe('buildUnreadTabCounts', () => {
  it('counts unread activity items directly', () => {
    expect(
      buildUnreadTabCounts(
        [
          { key: 'all', label: 'All' },
          { key: 'classes', label: 'Classes' },
          { key: 'payment', label: 'Payment' },
          { key: 'system', label: 'System' },
        ],
        SECTIONS,
      ),
    ).toEqual({
      all: 1,
      classes: 0,
      payment: 0,
      system: 0,
    });
  });
});

describe('resolveUnreadIdsForTab', () => {
  it('returns unread ids for the selected tab', () => {
    expect(resolveUnreadIdsForTab(SECTIONS, 'classes')).toEqual([]);
    expect(resolveUnreadIdsForTab(SECTIONS, 'all')).toEqual(['item-1']);
  });
});
