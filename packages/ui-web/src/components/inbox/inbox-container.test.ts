import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyReadStateToSections,
  applyScheduleActivityLocalTime,
  applySessionParentLocalHeadline,
  buildUnreadTabCounts,
  resolveReadIdsForActivity,
} from './inbox-container';
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
    expect(group.state?.isRead).toBe(true);
  });

  it('marks all group subactivities as read when parent group id is marked', () => {
    const next = applyReadStateToSections(SECTIONS, ['group-1']);
    const group = next[0]?.items[1];

    expect(group?.kind).toBe('group');
    if (group?.kind !== 'group') {
      throw new Error('Expected group item');
    }

    expect(group.subActivities?.items.every((sub) => sub.state?.isRead)).toBe(true);
    expect(group.state?.isRead).toBe(true);
  });

  it('marks grouped synthetic subactivity as read when backing DB id is read', () => {
    const sections: ActivityFeedSectionVM[] = [
      {
        label: 'Today',
        items: [
          {
            kind: 'group',
            ids: { id: 'group-aggregate', orgId: 'org-1' },
            timestamps: {
              occurredAt: '2026-03-04T12:00:00.000Z',
              createdAt: '2026-03-04T12:00:00.000Z',
            },
            tabKey: 'all',
            audience: { scope: { kind: 'global' }, visibility: 'public' },
            verb: 'class.created',
            refs: { actor: {} as never },
            grouping: { groupKey: 'group-aggregate', groupType: 'class' },
            content: { headline: { primary: 'Class created' } },
            subActivityCount: 1,
            subActivities: {
              items: [
                {
                  kind: 'leaf',
                  ids: { id: 'group-aggregate:members-invited', orgId: 'org-1' },
                  timestamps: {
                    occurredAt: '2026-03-04T12:00:00.000Z',
                    createdAt: '2026-03-04T12:00:00.000Z',
                  },
                  tabKey: 'all',
                  audience: { scope: { kind: 'global' }, visibility: 'public' },
                  verb: 'members.invited',
                  refs: { actor: {} as never },
                  content: { headline: { primary: '2 participants added' } },
                  metadata: {
                    readItemIds: [
                      '11111111-1111-4111-8111-111111111111',
                      '22222222-2222-4222-8222-222222222222',
                    ],
                  },
                  state: { isRead: false },
                },
              ],
              total: 1,
            },
            state: { isRead: false },
          },
        ],
      },
    ];

    const next = applyReadStateToSections(sections, [
      '11111111-1111-4111-8111-111111111111',
    ]);
    const group = next[0]?.items[0];

    expect(group?.kind).toBe('group');
    if (group?.kind !== 'group') {
      throw new Error('Expected group item');
    }

    expect(group.subActivities?.items[0]?.state?.isRead).toBe(true);
    expect(group.state?.isRead).toBe(true);
  });
});

describe('resolveReadIdsForActivity', () => {
  it('returns parent and child ids when group parent is marked', () => {
    expect(resolveReadIdsForActivity(SECTIONS, 'group-1')).toEqual(['group-1', 'sub-1']);
  });

  it('returns only sub id when subactivity is marked', () => {
    expect(resolveReadIdsForActivity(SECTIONS, 'sub-1')).toEqual(['sub-1']);
  });

  it('returns backing DB ids for aggregated synthetic subactivities', () => {
    const sections: ActivityFeedSectionVM[] = [
      {
        label: 'Today',
        items: [
          {
            kind: 'group',
            ids: { id: 'group-aggregate', orgId: 'org-1' },
            timestamps: {
              occurredAt: '2026-03-04T12:00:00.000Z',
              createdAt: '2026-03-04T12:00:00.000Z',
            },
            tabKey: 'all',
            audience: { scope: { kind: 'global' }, visibility: 'public' },
            verb: 'class.created',
            refs: { actor: {} as never },
            grouping: { groupKey: 'group-aggregate', groupType: 'class' },
            content: { headline: { primary: 'Class created' } },
            subActivityCount: 1,
            subActivities: {
              items: [
                {
                  kind: 'leaf',
                  ids: { id: 'group-aggregate:members-invited', orgId: 'org-1' },
                  timestamps: {
                    occurredAt: '2026-03-04T12:00:00.000Z',
                    createdAt: '2026-03-04T12:00:00.000Z',
                  },
                  tabKey: 'all',
                  audience: { scope: { kind: 'global' }, visibility: 'public' },
                  verb: 'members.invited',
                  refs: { actor: {} as never },
                  content: { headline: { primary: '2 participants added' } },
                  metadata: {
                    readItemIds: [
                      '11111111-1111-4111-8111-111111111111',
                      '22222222-2222-4222-8222-222222222222',
                    ],
                  },
                },
              ],
              total: 1,
            },
          },
        ],
      },
    ];

    expect(
      resolveReadIdsForActivity(sections, 'group-aggregate:members-invited'),
    ).toEqual([
      'group-aggregate:members-invited',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
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

    expect(source).toContain(
      'showActionButton={Boolean(displayActivity.content.actionButton)}',
    );
    expect(source).toContain(
      "if (displayActivity.verb === 'session.feedback_request.sent')",
    );
  });

  it('formats session parent headline using viewer local time metadata', () => {
    const activity = {
      kind: 'group' as const,
      ids: { id: 'group-1', orgId: 'org-1' },
      timestamps: {
        occurredAt: '2026-03-04T12:00:00.000Z',
        createdAt: '2026-03-04T12:00:00.000Z',
      },
      tabKey: 'classes' as const,
      audience: { scope: { kind: 'global' as const }, visibility: 'public' as const },
      verb: 'session.reminder.sent' as const,
      refs: { actor: {} as never },
      content: { headline: { primary: 'Class session', secondary: 'Algebra' } },
      metadata: {
        sessionGroupLocalTime: true,
        occurrenceStart: '2026-03-04T12:40:00.000Z',
      },
      subActivities: { items: [] },
    };

    const next = applySessionParentLocalHeadline(activity);
    expect(next.content.headline.primary).toContain('Class session ');
    expect(next.content.headline.primary).not.toBe('Class session');
  });

  it('formats schedule and reschedule/cancel activity labels using local time metadata', () => {
    const scheduled = applyScheduleActivityLocalTime({
      kind: 'leaf',
      ids: { id: 'leaf-scheduled', orgId: 'org-1' },
      timestamps: {
        occurredAt: '2026-03-04T12:00:00.000Z',
        createdAt: '2026-03-04T12:00:00.000Z',
      },
      tabKey: 'classes',
      audience: { scope: { kind: 'global' }, visibility: 'public' },
      verb: 'session.scheduled',
      refs: { actor: {} as never },
      content: {
        headline: { primary: 'Session scheduled' },
        summary: 'Session scheduled 2026-03-04T12:40:00.000Z.',
      },
      metadata: {
        sessionLocalTime: true,
        activityPhase: 'updated',
        startAt: '2026-03-04T12:40:00.000Z',
      },
    });

    const rescheduled = applyScheduleActivityLocalTime({
      kind: 'leaf',
      ids: { id: 'leaf-rescheduled', orgId: 'org-1' },
      timestamps: {
        occurredAt: '2026-03-04T12:00:00.000Z',
        createdAt: '2026-03-04T12:00:00.000Z',
      },
      tabKey: 'classes',
      audience: { scope: { kind: 'global' }, visibility: 'public' },
      verb: 'session.rescheduled',
      refs: { actor: {} as never },
      content: {
        headline: { primary: 'Session rescheduled' },
        summary: 'Next session later.',
      },
      metadata: {
        sessionLocalTime: true,
        rescheduledFromStartAt: '2026-03-04T12:40:00.000Z',
        rescheduledToStartAt: '2026-03-11T12:40:00.000Z',
        firstSessionStartAt: '2026-03-11T12:40:00.000Z',
      },
    });

    const canceled = applyScheduleActivityLocalTime({
      kind: 'leaf',
      ids: { id: 'leaf-canceled', orgId: 'org-1' },
      timestamps: {
        occurredAt: '2026-03-04T12:00:00.000Z',
        createdAt: '2026-03-04T12:00:00.000Z',
      },
      tabKey: 'classes',
      audience: { scope: { kind: 'global' }, visibility: 'public' },
      verb: 'session.canceled',
      refs: { actor: {} as never },
      content: {
        headline: { primary: 'Session cancelled' },
        summary: 'Next session later.',
      },
      metadata: {
        sessionLocalTime: true,
        canceledStartAt: '2026-03-04T12:40:00.000Z',
        firstSessionStartAt: '2026-03-11T12:40:00.000Z',
      },
    });

    expect(scheduled.content.summary).toContain('Session scheduled ');
    expect(scheduled.content.summary).not.toContain('2026-03-04T12:40:00.000Z');
    expect(rescheduled.content.headline.primary).toContain('rescheduled to');
    expect(rescheduled.content.headline.primary).not.toContain('2026-03');
    expect(canceled.content.headline.primary).toContain('Session ');
    expect(canceled.content.headline.primary).toContain('cancelled');
    expect(canceled.content.headline.primary).not.toContain('2026-03');
  });
});
