import type { AdminActivityFeedAuditVM } from '@iconicedu/shared-types';
import { describe, expect, it } from 'vitest';

import {
  buildPushNotificationDeliveryRows,
  filterPushNotificationDeliveryRows,
} from '@iconicedu/ui-web/components/admin/push-notification-delivery-status-dashboard';

function makeAudit(): AdminActivityFeedAuditVM {
  return {
    generatedAt: '2026-06-01T12:00:00.000Z',
    totalCount: 2,
    unreadCount: 1,
    pipelineJobCount: 0,
    reminderJobCount: 0,
    verbSummaries: [],
    items: [
      {
        id: 'activity-1',
        sourceEventId: 'event-1',
        verb: 'message.posted',
        tabKey: 'messages',
        summary: 'New message in Algebra',
        recipient: {
          profileId: 'profile-1',
          displayName: 'Ava Student',
          kind: 'student',
        },
        actor: {
          profileId: 'profile-2',
          displayName: 'Mina Teacher',
          kind: 'teacher',
        },
        channel: {
          channelId: 'channel-1',
          label: 'Algebra',
          kind: 'class',
        },
        scopeLabel: 'Algebra',
        isRead: false,
        occurredAt: '2026-06-01T11:58:00.000Z',
        createdAt: '2026-06-01T11:58:00.000Z',
        deliveryChannels: [
          {
            channel: 'push',
            status: 'failed',
            createdAt: '2026-06-01T12:00:00.000Z',
            lastError: 'Expo timeout',
          },
          {
            channel: 'email',
            status: 'succeeded',
            createdAt: '2026-06-01T12:00:01.000Z',
          },
        ],
        pipelineJobs: [],
        reminderJobs: [],
      },
      {
        id: 'activity-2',
        verb: 'session.reminder.sent',
        tabKey: 'schedule',
        summary: 'Class starts soon',
        recipient: {
          profileId: 'profile-3',
          displayName: 'Noah Guardian',
          kind: 'guardian',
        },
        actor: null,
        channel: null,
        scopeLabel: 'Calculus',
        isRead: true,
        occurredAt: '2026-06-01T12:03:00.000Z',
        createdAt: '2026-06-01T12:03:00.000Z',
        deliveryChannels: [
          {
            channel: 'push',
            status: 'succeeded',
            createdAt: '2026-06-01T12:04:00.000Z',
          },
        ],
        pipelineJobs: [],
        reminderJobs: [],
      },
    ],
  };
}

describe('push notification delivery status dashboard helpers', () => {
  it('builds rows only for push delivery attempts', () => {
    const rows = buildPushNotificationDeliveryRows(makeAudit());

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.activityId)).toEqual(['activity-2', 'activity-1']);
    expect(rows.some((row) => row.status === 'succeeded')).toBe(true);
  });

  it('filters rows by status and searchable fields', () => {
    const rows = buildPushNotificationDeliveryRows(makeAudit());

    expect(
      filterPushNotificationDeliveryRows(rows, {
        search: 'expo',
        status: 'failed',
      }),
    ).toEqual([rows[1]]);
    expect(
      filterPushNotificationDeliveryRows(rows, {
        search: 'guardian',
        status: 'succeeded',
      }),
    ).toEqual([rows[0]]);
  });
});
