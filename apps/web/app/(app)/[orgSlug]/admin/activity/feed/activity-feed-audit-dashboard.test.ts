import type { AdminActivityFeedItemVM } from '@iconicedu/shared-types';
import { describe, expect, it } from 'vitest';

import { filterActivityFeedAuditItems } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/feed/activity-feed-audit-dashboard';

function makeItem(overrides: Partial<AdminActivityFeedItemVM>): AdminActivityFeedItemVM {
  return {
    id: 'item-1',
    sourceEventId: 'event-1',
    verb: 'message.posted',
    tabKey: 'classes',
    summary: 'New message in Algebra',
    recipient: {
      profileId: 'recipient-1',
      displayName: 'Ava Student',
      kind: 'child',
    },
    actor: {
      profileId: 'actor-1',
      displayName: 'Mina Teacher',
      kind: 'educator',
    },
    channel: {
      channelId: 'channel-1',
      label: 'Algebra channel',
      kind: 'class',
    },
    scopeLabel: 'Algebra',
    importance: 'normal',
    isRead: false,
    occurredAt: '2026-05-05T12:00:00.000Z',
    createdAt: '2026-05-05T12:00:00.000Z',
    dedupeKey: 'dedupe-1',
    deliveryChannels: [{ channel: 'push', status: 'succeeded', createdAt: 'now' }],
    pipelineJobs: [
      {
        id: 'pipeline-1',
        kind: 'notification.prepare',
        status: 'succeeded',
        attemptCount: 1,
        runAt: '2026-05-05T12:00:00.000Z',
        createdAt: '2026-05-05T12:00:00.000Z',
      },
    ],
    reminderJobs: [],
    ...overrides,
  };
}

describe('filterActivityFeedAuditItems', () => {
  it('filters generated activity items by verb', () => {
    const items = [
      makeItem({ id: 'message', verb: 'message.posted' }),
      makeItem({ id: 'reminder', verb: 'session.reminder.sent' }),
    ];

    expect(
      filterActivityFeedAuditItems(items, {
        search: '',
        verb: 'session.reminder.sent',
      }),
    ).toEqual([items[1]]);
  });

  it('searches users, channels, and delivery channels', () => {
    const items = [
      makeItem({
        id: 'push',
        recipient: { profileId: 'r1', displayName: 'Ava', kind: 'child' },
      }),
      makeItem({
        id: 'email',
        recipient: { profileId: 'r2', displayName: 'Noah', kind: 'guardian' },
        channel: { channelId: 'channel-2', label: 'Billing', kind: 'support' },
        deliveryChannels: [{ channel: 'email', status: 'pending', createdAt: 'now' }],
      }),
    ];

    expect(
      filterActivityFeedAuditItems(items, { search: 'email pending', verb: 'all' }),
    ).toEqual([items[1]]);
    expect(
      filterActivityFeedAuditItems(items, { search: 'billing', verb: 'all' }),
    ).toEqual([items[1]]);
  });

  it('searches reminder and pipeline job details', () => {
    const items = [
      makeItem({ id: 'message', pipelineJobs: [] }),
      makeItem({
        id: 'reminder',
        verb: 'session.reminder.sent',
        reminderJobs: [
          {
            id: 'reminder-job-1',
            jobType: 'session.reminder',
            status: 'succeeded',
            targetKind: 'channel',
            targetId: 'channel-1',
            runAt: '2026-05-05T11:30:00.000Z',
            occurrenceStartAt: '2026-05-05T12:00:00.000Z',
            reminderOffsetMinutes: 30,
            attemptCount: 1,
            dispatchedAt: '2026-05-05T11:30:02.000Z',
            dispatchResult: 'succeeded',
          },
        ],
        pipelineJobs: [
          {
            id: 'pipeline-2',
            kind: 'notification.deliver',
            status: 'failed',
            attemptCount: 2,
            runAt: '2026-05-05T11:30:00.000Z',
            createdAt: '2026-05-05T11:30:00.000Z',
            lastError: 'Push provider timeout',
          },
        ],
      }),
    ];

    expect(
      filterActivityFeedAuditItems(items, {
        search: 'session.reminder 30m succeeded',
        verb: 'all',
      }),
    ).toEqual([items[1]]);
    expect(
      filterActivityFeedAuditItems(items, {
        search: 'notification.deliver failed',
        verb: 'all',
      }),
    ).toEqual([items[1]]);
  });
});
