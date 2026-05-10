import { NotificationService } from '@iconicedu/api/modules/events/notification.service';

jest.mock('@iconicedu/api/lib/notifications/decision-engine', () => ({
  buildNotificationDecision: jest.fn(async ({ event }) => {
    if (event.payload?.suppressNotifications === true) {
      return {
        deliveryChannels: [],
        deliveryTiming: 'immediate',
        runAt: '2026-05-05T12:00:00.000Z',
        reasonCodes: ['source_suppressed'],
        prefKey: event.event_type,
        scopeKind: null,
        scopeId: null,
      };
    }

    return {
      deliveryChannels: ['push'],
      deliveryTiming: 'immediate',
      runAt: '2026-05-05T12:00:00.000Z',
      reasonCodes: [],
      prefKey: event.event_type,
      scopeKind: null,
      scopeId: null,
    };
  }),
}));
jest.mock('@iconicedu/api/lib/notifications/providers/push-provider', () => ({
  sendPushNotification: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/notifications/providers/email-provider', () => ({
  sendEmailNotification: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/notifications/providers/sms-provider', () => ({
  sendSmsNotification: jest.fn(),
}));

function makeEvent(payload: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    org_id: 'org-1',
    event_type: 'message.posted',
    occurred_at: '2026-05-05T12:00:00.000Z',
    payload,
    scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
    source_kind: 'system',
    deleted_at: null,
  };
}

function longText(length: number) {
  return Array.from({ length }, (_, index) => String(index % 10)).join('');
}

function makeSupabase(event: Record<string, unknown>) {
  const rpc = jest.fn(async () => ({ data: { id: 'job-1' }, error: null }));
  const supabase = {
    rpc,
    from: jest.fn((table: string) => {
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        is: jest.fn(() => query),
        maybeSingle: jest.fn(async () => {
          if (table === 'activity_events') {
            return { data: event, error: null };
          }
          return { data: null, error: null };
        }),
      };
      return query;
    }),
  };
  return { supabase, rpc };
}

describe('NotificationService silent source events', () => {
  it('does not enqueue delivery jobs for silent activity events', async () => {
    const { supabase, rpc } = makeSupabase(makeEvent({ suppressNotifications: true }));
    const service = new NotificationService();

    await expect(
      service.prepareForActivityEvent({
        supabase: supabase as never,
        eventId: 'event-1',
        recipientProfileIds: ['profile-1'],
      }),
    ).resolves.toEqual({ enqueued: 0, suppressed: false });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('suppresses already queued deliveries when the latest event is silent', async () => {
    const { supabase } = makeSupabase(makeEvent({ suppressNotifications: true }));
    const service = new NotificationService();

    await expect(
      service.deliver({
        supabase: supabase as never,
        job: {
          id: 'job-1',
          org_id: 'org-1',
          payload: {
            activityEventId: 'event-1',
            recipientProfileId: 'profile-1',
            deliveryChannel: 'push',
            prefKey: 'message.posted',
          },
        } as never,
      }),
    ).resolves.toMatchObject({
      suppressed: true,
      reason: 'no_longer_eligible',
      reasonCodes: ['source_suppressed'],
    });
  });

  it('truncates queued notification summaries to 150 characters', async () => {
    const { supabase, rpc } = makeSupabase(
      makeEvent({
        title: 'Long update',
        content: longText(220),
      }),
    );
    const service = new NotificationService();

    await service.prepareForActivityEvent({
      supabase: supabase as never,
      eventId: 'event-1',
      recipientProfileIds: ['profile-1'],
    });

    const payload = rpc.mock.calls[0]?.[1]?.p_payload as
      | Record<string, unknown>
      | undefined;
    expect(typeof payload?.summary).toBe('string');
    expect((payload!.summary as string).length).toBeLessThanOrEqual(150);
    expect(payload!.summary).toMatch(/\.\.\.$/);
  });
});
