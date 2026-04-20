import { describe, expect, it, vi } from 'vitest';

import {
  buildDeliveryPlan,
  buildNotificationDecision,
} from '@iconicedu/web/lib/notifications/decision-engine';

function buildEvent(input: {
  eventType?: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}) {
  const occurredAt = input.occurredAt ?? '2026-03-11T12:00:00.000Z';

  return {
    id: 'event-1',
    org_id: 'org-1',
    event_type: input.eventType ?? 'message.posted',
    occurred_at: occurredAt,
    source_kind: 'profile' as const,
    actor_profile_id: 'profile-actor',
    scope: { kind: 'channel', channelId: 'channel-1' },
    object_ref: null,
    target_ref: null,
    payload: input.payload ?? {},
    audience_rules: [],
    dedupe_key: null,
    projection_status: 'pending' as const,
    projection_attempts: 0,
    created_at: occurredAt,
    updated_at: occurredAt,
  };
}

describe('buildDeliveryPlan', () => {
  it('delays non-critical delivery when presence is active', () => {
    const decision = buildDeliveryPlan({
      event: buildEvent({ eventType: 'message.posted' }),
      recipientProfileId: 'profile-target',
      channels: ['push'],
      reasonCodes: ['global_preference'],
      context: {
        now: new Date('2026-03-11T12:00:00.000Z'),
        liveStatus: 'online',
        lastSeenAt: '2026-03-11T11:59:45.000Z',
      },
    });

    expect(decision.deliveryTiming).toBe('delayed');
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining(['global_preference', 'presence_active']),
    );
  });

  it('uses a 30 second delay for mentioned channel messages when presence is active', () => {
    const decision = buildDeliveryPlan({
      event: buildEvent({
        eventType: 'message.posted',
        payload: { mentionedProfileId: 'profile-target' },
      }),
      recipientProfileId: 'profile-target',
      channels: ['push'],
      reasonCodes: ['global_preference'],
      context: {
        now: new Date('2026-03-11T12:00:00.000Z'),
        liveStatus: 'online',
        lastSeenAt: '2026-03-11T11:59:45.000Z',
      },
    });

    expect(decision.deliveryTiming).toBe('delayed');
    expect(decision.runAt).toBe('2026-03-11T12:00:30.000Z');
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining(['presence_active', 'mention_priority_override']),
    );
  });

  it('uses a 60 second delay for non-mention channel messages when presence is active', () => {
    const decision = buildDeliveryPlan({
      event: buildEvent({ eventType: 'message.posted' }),
      recipientProfileId: 'profile-target',
      channels: ['push'],
      reasonCodes: ['global_preference'],
      context: {
        now: new Date('2026-03-11T12:00:00.000Z'),
        liveStatus: 'online',
        lastSeenAt: '2026-03-11T11:59:45.000Z',
      },
    });

    expect(decision.deliveryTiming).toBe('delayed');
    expect(decision.runAt).toBe('2026-03-11T12:01:00.000Z');
    expect(decision.reasonCodes).not.toContain('mention_priority_override');
  });

  it('uses a 60 second delay for reaction.added when presence is active', () => {
    const decision = buildDeliveryPlan({
      event: buildEvent({ eventType: 'reaction.added' }),
      recipientProfileId: 'profile-target',
      channels: ['push'],
      reasonCodes: ['global_preference'],
      context: {
        now: new Date('2026-03-11T12:00:00.000Z'),
        liveStatus: 'online',
        lastSeenAt: '2026-03-11T11:59:45.000Z',
      },
    });

    expect(decision.deliveryTiming).toBe('delayed');
    expect(decision.runAt).toBe('2026-03-11T12:01:00.000Z');
  });

  it('uses the default 120 second delay for uncategorized events when presence is active', () => {
    const decision = buildDeliveryPlan({
      event: buildEvent({ eventType: 'custom.event' }),
      recipientProfileId: 'profile-target',
      channels: ['push'],
      reasonCodes: ['global_preference'],
      context: {
        now: new Date('2026-03-11T12:00:00.000Z'),
        liveStatus: 'online',
        lastSeenAt: '2026-03-11T11:59:45.000Z',
      },
    });

    expect(decision.deliveryTiming).toBe('delayed');
    expect(decision.runAt).toBe('2026-03-11T12:02:00.000Z');
  });

  it('does not delay when presence is active but stale', () => {
    const decision = buildDeliveryPlan({
      event: buildEvent({ eventType: 'message.posted' }),
      recipientProfileId: 'profile-target',
      channels: ['push'],
      reasonCodes: ['global_preference'],
      context: {
        now: new Date('2026-03-11T12:00:00.000Z'),
        liveStatus: 'in_class',
        lastSeenAt: '2026-03-11T11:54:59.000Z',
      },
    });

    expect(decision.deliveryTiming).toBe('immediate');
    expect(decision.reasonCodes).not.toContain('presence_active');
  });
});

describe('buildNotificationDecision', () => {
  it('uses scoped preference over global preference', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'notification_preference_scopes') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: { channels: ['sms'], muted: false },
              error: null,
            })),
          };
          return {
            select: vi.fn(() => chain),
          };
        }

        if (table === 'notification_preferences') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: { channels: ['push'], muted: false },
              error: null,
            })),
          };
          return {
            select: vi.fn(() => chain),
          };
        }

        if (table === 'profiles') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: { account_id: 'account-1' },
              error: null,
            })),
          };
          return {
            select: vi.fn(() => chain),
          };
        }

        if (table === 'profile_presence') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: {
                live_status: 'offline',
                last_seen_at: '2026-03-11T11:59:30.000Z',
              },
              error: null,
            })),
          };
          return {
            select: vi.fn(() => chain),
          };
        }

        if (table === 'channel_read_state') {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            maybeSingle: vi.fn(async () => ({
              data: { last_read_at: null },
              error: null,
            })),
          };
          return {
            select: vi.fn(() => chain),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const decision = await buildNotificationDecision({
      supabase: supabase as never,
      recipientProfileId: 'profile-target',
      event: buildEvent({ eventType: 'message.posted' }),
    });

    expect(decision.deliveryChannels).toEqual(['sms']);
    expect(decision.reasonCodes).toContain('scoped_preference');
  });
});
