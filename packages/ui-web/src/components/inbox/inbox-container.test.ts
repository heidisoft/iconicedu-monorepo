import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyReadStateToSections, buildUnreadTabCounts } from './inbox-container';
import type { ActivityFeedSectionVM, ActivityFeedTabVM } from '@iconicedu/shared-types';

const SECTIONS: ActivityFeedSectionVM[] = [
  {
    label: 'Today',
    items: [
      {
        kind: 'leaf',
        ids: { id: 'leaf-1', orgId: 'org-1' },
        timestamps: {
          occurredAt: '2026-03-04T12:00:00.000Z',
          createdAt: '2026-03-04T12:00:00.000Z',
        },
        tabKey: 'all',
        audience: { scope: { kind: 'global' }, visibility: 'public' },
        verb: 'message.posted',
        refs: { actor: {} as never },
        content: { headline: { primary: 'Leaf item' } },
        state: { isRead: false },
      },
      {
        kind: 'group',
        ids: { id: 'group-1', orgId: 'org-1' },
        timestamps: {
          occurredAt: '2026-03-04T12:00:00.000Z',
          createdAt: '2026-03-04T12:00:00.000Z',
        },
        tabKey: 'all',
        audience: { scope: { kind: 'global' }, visibility: 'public' },
        verb: 'homework.assigned',
        refs: { actor: {} as never },
        grouping: { groupKey: 'group-1', groupType: 'homework' },
        content: { headline: { primary: 'Group item' } },
        state: { isRead: false },
        subActivityCount: 1,
        subActivities: {
          items: [
            {
              kind: 'leaf',
              ids: { id: 'sub-1', orgId: 'org-1' },
              timestamps: {
                occurredAt: '2026-03-04T12:00:00.000Z',
                createdAt: '2026-03-04T12:00:00.000Z',
              },
              tabKey: 'all',
              audience: { scope: { kind: 'global' }, visibility: 'public' },
              verb: 'homework.assigned',
              refs: { actor: {} as never },
              content: { headline: { primary: 'Sub item' } },
              state: { isRead: false },
            },
          ],
          total: 1,
        },
      },
    ],
  },
];

const TABS: ActivityFeedTabVM[] = [
  { key: 'all', label: 'All' },
  { key: 'classes', label: 'Classes' },
  { key: 'payment', label: 'Payment' },
  { key: 'system', label: 'System' },
];

describe('applyReadStateToSections', () => {
  it('marks matching leaf items as read', () => {
    const next = applyReadStateToSections(SECTIONS, ['leaf-1']);

    expect(next[0]?.items[0]?.state?.isRead).toBe(true);
    expect(next[0]?.items[1]?.state?.isRead).toBe(false);
  });

  it('marks matching grouped subactivities as read', () => {
    const next = applyReadStateToSections(SECTIONS, ['sub-1']);
    const group = next[0]?.items[1];

    expect(group?.kind).toBe('group');
    if (group?.kind !== 'group') {
      throw new Error('Expected group item');
    }

    expect(group.subActivities?.items[0]?.state?.isRead).toBe(true);
    expect(group.state?.isRead).toBe(false);
  });
});

describe('buildUnreadTabCounts', () => {
  it('counts unread leaf and grouped subactivities per tab', () => {
    const counts = buildUnreadTabCounts(TABS, [
      {
        label: 'Today',
        items: [
          {
            kind: 'leaf',
            ids: { id: 'leaf-classes', orgId: 'org-1' },
            timestamps: {
              occurredAt: '2026-03-04T12:00:00.000Z',
              createdAt: '2026-03-04T12:00:00.000Z',
            },
            tabKey: 'classes',
            audience: { scope: { kind: 'global' }, visibility: 'public' },
            verb: 'class.created',
            refs: { actor: {} as never },
            content: { headline: { primary: 'Leaf item' } },
            state: { isRead: false },
          },
          {
            kind: 'group',
            ids: { id: 'group-classes', orgId: 'org-1' },
            timestamps: {
              occurredAt: '2026-03-04T12:00:00.000Z',
              createdAt: '2026-03-04T12:00:00.000Z',
            },
            tabKey: 'classes',
            audience: { scope: { kind: 'global' }, visibility: 'public' },
            verb: 'homework.assigned',
            refs: { actor: {} as never },
            grouping: { groupKey: 'group-classes', groupType: 'homework' },
            content: { headline: { primary: 'Grouped item' } },
            state: { isRead: false },
            subActivityCount: 2,
            subActivities: {
              items: [
                {
                  kind: 'leaf',
                  ids: { id: 'sub-read', orgId: 'org-1' },
                  timestamps: {
                    occurredAt: '2026-03-04T12:00:00.000Z',
                    createdAt: '2026-03-04T12:00:00.000Z',
                  },
                  tabKey: 'classes',
                  audience: { scope: { kind: 'global' }, visibility: 'public' },
                  verb: 'homework.assigned',
                  refs: { actor: {} as never },
                  content: { headline: { primary: 'Read sub item' } },
                  state: { isRead: true },
                },
                {
                  kind: 'leaf',
                  ids: { id: 'sub-unread', orgId: 'org-1' },
                  timestamps: {
                    occurredAt: '2026-03-04T12:00:00.000Z',
                    createdAt: '2026-03-04T12:00:00.000Z',
                  },
                  tabKey: 'classes',
                  audience: { scope: { kind: 'global' }, visibility: 'public' },
                  verb: 'homework.assigned',
                  refs: { actor: {} as never },
                  content: { headline: { primary: 'Unread sub item' } },
                  state: { isRead: false },
                },
              ],
              total: 2,
            },
          },
        ],
      },
    ]);

    expect(counts.all).toBe(2);
    expect(counts.classes).toBe(2);
    expect(counts.payment).toBe(0);
    expect(counts.system).toBe(0);
  });
});

describe('InboxContainer rendering behavior', () => {
  it('does not force-hide action buttons for grouped or expanded activities', () => {
    const filename = fileURLToPath(import.meta.url);
    const source = readFileSync(
      resolve(dirname(filename), 'inbox-container.tsx'),
      'utf8',
    );

    expect(source).not.toContain('showActionButton={false}');
    expect(source).toContain('showActionButton={Boolean(activity.content.actionButton)}');
  });
});
