import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dispatchDueNotificationJobs,
  enqueueNotificationDispatchJobs,
} from '@iconicedu/web/lib/notifications/dispatch-jobs';

const buildNotificationDecision = vi.fn();
const sendPushNotification = vi.fn();
const sendEmailNotification = vi.fn();
const sendSmsNotification = vi.fn();

vi.mock('@iconicedu/web/lib/notifications/decision-engine', () => ({
  buildNotificationDecision: (...args: unknown[]) => buildNotificationDecision(...args),
}));

vi.mock('@iconicedu/web/lib/notifications/providers/push-provider', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotification(...args),
}));

vi.mock('@iconicedu/web/lib/notifications/providers/email-provider', () => ({
  sendEmailNotification: (...args: unknown[]) => sendEmailNotification(...args),
}));

vi.mock('@iconicedu/web/lib/notifications/providers/sms-provider', () => ({
  sendSmsNotification: (...args: unknown[]) => sendSmsNotification(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enqueueNotificationDispatchJobs', () => {
  it('creates one job row per recipient/channel', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    };

    buildNotificationDecision.mockResolvedValue({
      deliveryChannels: ['push', 'email'],
      deliveryTiming: 'immediate',
      runAt: '2026-03-11T12:00:00.000Z',
      reasonCodes: ['global_preference'],
      scopeKind: 'channel',
      scopeId: 'channel-1',
    });

    const result = await enqueueNotificationDispatchJobs({
      supabase: supabase as never,
      event: {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'message.posted',
        occurred_at: '2026-03-11T12:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: null,
        target_ref: null,
        payload: { title: 'Message posted', summary: 'A new message arrived' },
        audience_rules: [],
        dedupe_key: null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-11T12:00:00.000Z',
        updated_at: '2026-03-11T12:00:00.000Z',
      },
      recipientProfileIds: ['profile-1'],
    });

    expect(result).toEqual({ enqueued: 2 });
    expect(supabase.from).toHaveBeenCalledWith('notification_dispatch_jobs');
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          activity_event_id: 'event-1',
          recipient_profile_id: 'profile-1',
          delivery_channel: 'push',
        }),
        expect.objectContaining({
          activity_event_id: 'event-1',
          recipient_profile_id: 'profile-1',
          delivery_channel: 'email',
        }),
      ]),
      {
        onConflict:
          'activity_event_id,recipient_profile_id,delivery_channel,attempt_bucket',
      },
    );
  });

  it('stores personalized reminder titles per recipient', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = { from: vi.fn(() => ({ upsert })) };

    buildNotificationDecision.mockResolvedValue({
      deliveryChannels: ['push'],
      deliveryTiming: 'immediate',
      runAt: '2026-03-11T12:00:00.000Z',
      reasonCodes: ['global_preference'],
      scopeKind: 'channel',
      scopeId: 'channel-1',
    });

    await enqueueNotificationDispatchJobs({
      supabase: supabase as never,
      event: {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'session.reminder.sent',
        occurred_at: '2026-03-11T12:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: null,
        target_ref: null,
        payload: {
          title: 'Session reminder',
          summary: 'Reminder',
          reminderOffsetMinutes: 5,
          members: [
            { profileId: 'child-1', role: 'child', displayName: 'Ava' },
            { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
          ],
        },
        audience_rules: [],
        dedupe_key: null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-11T12:00:00.000Z',
        updated_at: '2026-03-11T12:00:00.000Z',
      },
      recipientProfileIds: ['child-1', 'educator-1'],
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          recipient_profile_id: 'child-1',
          payload: expect.objectContaining({
            title: 'Session reminder with Mr. Kim starts in 5 min',
          }),
        }),
        expect.objectContaining({
          recipient_profile_id: 'educator-1',
          payload: expect.objectContaining({
            title: 'Session reminder with Ava starts in 5 min',
          }),
        }),
      ]),
      expect.any(Object),
    );
  });

  it('falls back to generic title when members are absent', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = { from: vi.fn(() => ({ upsert })) };

    buildNotificationDecision.mockResolvedValue({
      deliveryChannels: ['push'],
      deliveryTiming: 'immediate',
      runAt: '2026-03-11T12:00:00.000Z',
      reasonCodes: ['global_preference'],
      scopeKind: 'channel',
      scopeId: 'channel-1',
    });

    await enqueueNotificationDispatchJobs({
      supabase: supabase as never,
      event: {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'session.reminder.sent',
        occurred_at: '2026-03-11T12:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: null,
        target_ref: null,
        payload: {
          title: 'Session reminder',
          summary: 'Reminder',
          reminderOffsetMinutes: 5,
        },
        audience_rules: [],
        dedupe_key: null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-11T12:00:00.000Z',
        updated_at: '2026-03-11T12:00:00.000Z',
      },
      recipientProfileIds: ['child-1'],
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          recipient_profile_id: 'child-1',
          payload: expect.objectContaining({
            title: 'Session reminder',
            summary: 'Reminder',
          }),
        }),
      ]),
      expect.any(Object),
    );
  });

  it('creates different titles for different roles in the same event', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = { from: vi.fn(() => ({ upsert })) };

    buildNotificationDecision.mockResolvedValue({
      deliveryChannels: ['push'],
      deliveryTiming: 'immediate',
      runAt: '2026-03-11T12:00:00.000Z',
      reasonCodes: ['global_preference'],
      scopeKind: 'channel',
      scopeId: 'channel-1',
    });

    await enqueueNotificationDispatchJobs({
      supabase: supabase as never,
      event: {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'session.reminder.sent',
        occurred_at: '2026-03-11T12:00:00.000Z',
        source_kind: 'profile',
        actor_profile_id: 'profile-actor',
        scope: { kind: 'channel', channelId: 'channel-1' },
        object_ref: null,
        target_ref: null,
        payload: {
          title: 'Session reminder',
          summary: 'Reminder',
          reminderOffsetMinutes: 30,
          members: [
            { profileId: 'child-1', role: 'child', displayName: 'Ava' },
            { profileId: 'educator-1', role: 'educator', displayName: 'Mr. Kim' },
            { profileId: 'guardian-1', role: 'guardian', displayName: 'Parent' },
          ],
        },
        audience_rules: [],
        dedupe_key: null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-11T12:00:00.000Z',
        updated_at: '2026-03-11T12:00:00.000Z',
      },
      recipientProfileIds: ['child-1', 'educator-1', 'guardian-1'],
    });

    const calls = upsert.mock.calls[0][0];
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipient_profile_id: 'child-1',
          payload: expect.objectContaining({
            title: 'Session reminder with Mr. Kim starts in 30 min',
          }),
        }),
        expect.objectContaining({
          recipient_profile_id: 'educator-1',
          payload: expect.objectContaining({
            title: 'Session reminder with Ava starts in 30 min',
          }),
        }),
        expect.objectContaining({
          recipient_profile_id: 'guardian-1',
          payload: expect.objectContaining({
            title: 'Session reminder for Ava with Mr. Kim starts in 30 min',
          }),
        }),
      ]),
    );
  });

  it('keeps one row for duplicate event/channel/recipient by idempotency key semantics', async () => {
    const persisted = new Map<string, Record<string, unknown>>();
    const upsert = vi.fn(async (rows: Array<Record<string, unknown>>) => {
      rows.forEach((row) => {
        const key = [
          row.activity_event_id,
          row.recipient_profile_id,
          row.delivery_channel,
          row.attempt_bucket,
        ].join('|');
        persisted.set(key, row);
      });
      return { error: null };
    });
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    };

    buildNotificationDecision.mockResolvedValue({
      deliveryChannels: ['push'],
      deliveryTiming: 'immediate',
      runAt: '2026-03-11T12:00:00.000Z',
      reasonCodes: ['global_preference'],
      scopeKind: 'channel',
      scopeId: 'channel-1',
    });

    const event = {
      id: 'event-1',
      org_id: 'org-1',
      event_type: 'message.posted',
      occurred_at: '2026-03-11T12:00:00.000Z',
      source_kind: 'profile',
      actor_profile_id: 'profile-actor',
      scope: { kind: 'channel', channelId: 'channel-1' },
      object_ref: null,
      target_ref: null,
      payload: { title: 'Message posted' },
      audience_rules: [],
      dedupe_key: null,
      projection_status: 'pending',
      projection_attempts: 0,
      created_at: '2026-03-11T12:00:00.000Z',
      updated_at: '2026-03-11T12:00:00.000Z',
    };

    await enqueueNotificationDispatchJobs({
      supabase: supabase as never,
      event,
      recipientProfileIds: ['profile-1'],
    });
    await enqueueNotificationDispatchJobs({
      supabase: supabase as never,
      event,
      recipientProfileIds: ['profile-1'],
    });

    expect(persisted.size).toBe(1);
  });
});

describe('dispatchDueNotificationJobs', () => {
  it('routes to provider adapter by channel and logs success', async () => {
    const claimRows = [
      {
        id: 'job-1',
        org_id: 'org-1',
        activity_event_id: 'event-1',
        recipient_profile_id: 'profile-1',
        pref_key: 'message.posted',
        delivery_channel: 'push',
        delivery_timing: 'immediate',
        attempt_bucket: 'immediate:2026-03-11T12:00',
        run_at: '2026-03-11T12:00:00.000Z',
        payload: { title: 'Message posted', summary: 'A new message arrived' },
        status: 'leased',
        attempt_count: 0,
        max_attempts: 8,
      },
      {
        id: 'job-2',
        org_id: 'org-1',
        activity_event_id: 'event-1',
        recipient_profile_id: 'profile-1',
        pref_key: 'message.posted',
        delivery_channel: 'email',
        delivery_timing: 'immediate',
        attempt_bucket: 'immediate:2026-03-11T12:00',
        run_at: '2026-03-11T12:00:00.000Z',
        payload: { title: 'Message posted', summary: 'A new message arrived' },
        status: 'leased',
        attempt_count: 0,
        max_attempts: 8,
      },
      {
        id: 'job-3',
        org_id: 'org-1',
        activity_event_id: 'event-1',
        recipient_profile_id: 'profile-1',
        pref_key: 'message.posted',
        delivery_channel: 'sms',
        delivery_timing: 'immediate',
        attempt_bucket: 'immediate:2026-03-11T12:00',
        run_at: '2026-03-11T12:00:00.000Z',
        payload: { title: 'Message posted', summary: 'A new message arrived' },
        status: 'leased',
        attempt_count: 0,
        max_attempts: 8,
      },
    ];

    buildNotificationDecision.mockResolvedValue({
      deliveryChannels: ['push', 'email', 'sms'],
      deliveryTiming: 'immediate',
      runAt: '2026-03-11T12:00:00.000Z',
      reasonCodes: ['global_preference'],
      scopeKind: 'channel',
      scopeId: 'channel-1',
    });

    const supabase = {
      rpc: vi.fn(async () => ({ data: claimRows, error: null })),
      from: vi.fn((table: string) => {
        if (table === 'activity_feed_items') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: { id: 'feed-1' },
              error: null,
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'activity_events') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: {
                id: 'event-1',
                org_id: 'org-1',
                event_type: 'message.posted',
                occurred_at: '2026-03-11T12:00:00.000Z',
                source_kind: 'profile',
                actor_profile_id: 'profile-actor',
                scope: { kind: 'channel', channelId: 'channel-1' },
                object_ref: null,
                target_ref: null,
                payload: {},
                audience_rules: [],
                dedupe_key: null,
                projection_status: 'projected',
                projection_attempts: 1,
                created_at: '2026-03-11T12:00:00.000Z',
                updated_at: '2026-03-11T12:00:00.000Z',
              },
              error: null,
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'notification_dispatch_jobs') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            })),
          };
        }

        if (table === 'notification_dispatch_logs') {
          return {
            insert: vi.fn(async () => ({ error: null })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await dispatchDueNotificationJobs({
      supabase: supabase as never,
      leaseOwner: 'worker-1',
      limit: 10,
      leaseSeconds: 120,
    });

    expect(result.succeeded).toBe(3);
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ activityFeedItemId: 'feed-1' }),
    );
    expect(sendEmailNotification).toHaveBeenCalledTimes(1);
    expect(sendSmsNotification).toHaveBeenCalledTimes(1);
  });

  it('still sends push when activity feed item lookup fails', async () => {
    sendPushNotification.mockResolvedValue({ ticketIds: ['ticket-1'] });
    const claimRows = [
      {
        id: 'job-1',
        org_id: 'org-1',
        activity_event_id: 'event-1',
        recipient_profile_id: 'profile-1',
        pref_key: 'dm.posted',
        delivery_channel: 'push',
        delivery_timing: 'immediate',
        attempt_bucket: 'immediate:2026-03-11T12:00',
        run_at: '2026-03-11T12:00:00.000Z',
        payload: { title: 'New direct message', summary: 'Hello there' },
        status: 'leased',
        attempt_count: 0,
        max_attempts: 8,
      },
    ];

    buildNotificationDecision.mockResolvedValue({
      deliveryChannels: ['push'],
      deliveryTiming: 'immediate',
      runAt: '2026-03-11T12:00:00.000Z',
      reasonCodes: ['global_preference'],
      scopeKind: 'channel',
      scopeId: 'channel-1',
    });

    const supabase = {
      rpc: vi.fn(async () => ({ data: claimRows, error: null })),
      from: vi.fn((table: string) => {
        if (table === 'activity_feed_items') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: { message: 'lookup failed' },
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'activity_events') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: {
                id: 'event-1',
                org_id: 'org-1',
                event_type: 'dm.posted',
                occurred_at: '2026-03-11T12:00:00.000Z',
                source_kind: 'profile',
                actor_profile_id: 'profile-actor',
                scope: { kind: 'channel', channelId: 'channel-1' },
                object_ref: null,
                target_ref: null,
                payload: {},
                audience_rules: [],
                dedupe_key: null,
                projection_status: 'projected',
                projection_attempts: 1,
                created_at: '2026-03-11T12:00:00.000Z',
                updated_at: '2026-03-11T12:00:00.000Z',
              },
              error: null,
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'notification_dispatch_jobs') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            })),
          };
        }

        if (table === 'notification_dispatch_logs') {
          return {
            insert: vi.fn(async () => ({ error: null })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await dispatchDueNotificationJobs({
      supabase: supabase as never,
      leaseOwner: 'worker-1',
    });

    expect(result.succeeded).toBe(1);
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        prefKey: 'dm.posted',
        activityFeedItemId: null,
      }),
    );
  });

  it('stores expo ticket ids back onto the dispatch job payload after push send', async () => {
    sendPushNotification.mockResolvedValue({ ticketIds: ['ticket-1', 'ticket-2'] });

    const claimRows = [
      {
        id: 'job-1',
        org_id: 'org-1',
        activity_event_id: 'event-1',
        recipient_profile_id: 'profile-1',
        pref_key: 'message.posted',
        delivery_channel: 'push',
        delivery_timing: 'immediate',
        attempt_bucket: 'immediate:2026-03-11T12:00',
        run_at: '2026-03-11T12:00:00.000Z',
        payload: { title: 'Message posted', summary: 'A new message arrived' },
        status: 'leased',
        attempt_count: 0,
        max_attempts: 8,
      },
    ];

    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));

    const supabase = {
      rpc: vi.fn(async () => ({ data: claimRows, error: null })),
      from: vi.fn((table: string) => {
        if (table === 'activity_feed_items') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: { id: 'feed-1' },
              error: null,
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'activity_events') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: {
                id: 'event-1',
                org_id: 'org-1',
                event_type: 'message.posted',
                occurred_at: '2026-03-11T12:00:00.000Z',
                source_kind: 'profile',
                actor_profile_id: 'profile-actor',
                scope: { kind: 'channel', channelId: 'channel-1' },
                object_ref: null,
                target_ref: null,
                payload: {},
                audience_rules: [],
                dedupe_key: null,
                projection_status: 'projected',
                projection_attempts: 1,
                created_at: '2026-03-11T12:00:00.000Z',
                updated_at: '2026-03-11T12:00:00.000Z',
              },
              error: null,
            })),
          };
          return { select: vi.fn(() => chain) };
        }

        if (table === 'notification_dispatch_jobs') {
          return { update };
        }

        if (table === 'notification_dispatch_logs') {
          return {
            insert: vi.fn(async () => ({ error: null })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await dispatchDueNotificationJobs({
      supabase: supabase as never,
      leaseOwner: 'worker-1',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          expoTicketIds: ['ticket-1', 'ticket-2'],
        }),
      }),
    );
  });
});
