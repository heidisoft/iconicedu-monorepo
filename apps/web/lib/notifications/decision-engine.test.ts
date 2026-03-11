import { describe, expect, it, vi } from 'vitest';

import {
  buildDeliveryPlan,
  buildNotificationDecision,
} from '@iconicedu/web/lib/notifications/decision-engine';

describe('buildDeliveryPlan', () => {
  it('delays non-critical delivery when presence is active', () => {
    const decision = buildDeliveryPlan({
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
        payload: {},
        audience_rules: [],
        dedupe_key: null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-11T12:00:00.000Z',
        updated_at: '2026-03-11T12:00:00.000Z',
      },
      recipientProfileId: 'profile-target',
      channels: ['push'],
      reasonCodes: ['global_preference'],
      context: {
        liveStatus: 'online',
      },
    });

    expect(decision.deliveryTiming).toBe('delayed');
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining(['global_preference', 'presence_active']),
    );
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
              data: { live_status: 'offline' },
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
        payload: {},
        audience_rules: [],
        dedupe_key: null,
        projection_status: 'pending',
        projection_attempts: 0,
        created_at: '2026-03-11T12:00:00.000Z',
        updated_at: '2026-03-11T12:00:00.000Z',
      },
    });

    expect(decision.deliveryChannels).toEqual(['sms']);
    expect(decision.reasonCodes).toContain('scoped_preference');
  });
});
