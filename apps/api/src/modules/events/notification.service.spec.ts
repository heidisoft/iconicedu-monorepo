import { NotificationService } from '@iconicedu/api/modules/events/notification.service';
import { sendPushNotification } from '@iconicedu/api/lib/notifications/providers/push-provider';
import { buildNotificationDecision } from '@iconicedu/api/lib/notifications/decision-engine';

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

function makeSupabase(
  event: Record<string, unknown>,
  profiles: Array<Record<string, unknown>> = [],
  familyLinks: Array<{
    guardian_account_id: string;
    child_account_id: string;
  }> = [],
  options: { priorUnreadMessage?: { id: string } | null } = {},
) {
  const rpc = jest.fn(async () => ({ data: { id: 'job-1' }, error: null }));
  const supabase = {
    rpc,
    from: jest.fn((table: string) => {
      const filters = new Map<string, unknown>();
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn((column: string, value: unknown) => {
          filters.set(column, value);
          return query;
        }),
        neq: jest.fn(() => query),
        lt: jest.fn(() => query),
        gt: jest.fn(() => query),
        limit: jest.fn(() => query),
        in: jest.fn((column: string, value: unknown) => {
          filters.set(column, value);
          return query;
        }),
        is: jest.fn(() => query),
        maybeSingle: jest.fn(async () => {
          if (table === 'activity_events') {
            return { data: event, error: null };
          }
          if (table === 'messages') {
            return { data: options.priorUnreadMessage ?? null, error: null };
          }
          return { data: null, error: null };
        }),
        returns: jest.fn(async () => {
          if (table === 'profiles') {
            const idFilter = filters.get('id');
            const accountFilter = filters.get('account_id');
            return {
              data: Array.isArray(idFilter)
                ? profiles.filter((profile) => idFilter.includes(profile.id))
                : Array.isArray(accountFilter)
                  ? profiles.filter((profile) =>
                      accountFilter.includes(profile.account_id),
                    )
                  : profiles,
              error: null,
            };
          }
          if (table === 'family_links') {
            const childAccountFilter = filters.get('child_account_id');
            return {
              data: Array.isArray(childAccountFilter)
                ? familyLinks.filter((link) =>
                    childAccountFilter.includes(link.child_account_id),
                  )
                : familyLinks,
              error: null,
            };
          }
          return { data: [], error: null };
        }),
      };
      return query;
    }),
  };
  return { supabase, rpc };
}

describe('NotificationService reminder push priority', () => {
  it.each([
    ['session.reminder.sent', 15, 'high'],
    ['session.reminder.sent', 720, undefined],
    ['session.reminder.sent', 5, undefined],
    ['session.reminder.sent', undefined, undefined],
    ['message.posted', 15, undefined],
  ])('uses priority %s / offset %s -> %s', async (eventType, offset, priority) => {
    jest.mocked(sendPushNotification).mockClear();
    const { supabase } = makeSupabase({
      ...makeEvent({ reminderOffsetMinutes: offset }),
      event_type: eventType,
    });
    await new NotificationService().deliver({
      supabase: supabase as never,
      job: {
        id: 'job-1',
        org_id: 'org-1',
        payload: {
          activityEventId: 'event-1',
          recipientProfileId: 'profile-1',
          deliveryChannel: 'push',
          prefKey: eventType,
          // Delivery uses the latest source event, even if queued metadata is stale.
          rawEventPayload: { reminderOffsetMinutes: 30 },
        },
      } as never,
    });
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    const sent = jest.mocked(sendPushNotification).mock.calls[0]?.[0];
    if (priority) expect(sent).toHaveProperty('priority', 'high');
    else expect(sent).not.toHaveProperty('priority');
  });
});

describe('NotificationService first-unread message push priority', () => {
  const baseDecision = {
    eventId: 'event-1',
    recipientProfileId: 'profile-1',
    prefKey: 'message.posted',
    shouldWriteInbox: true,
    deliveryChannels: ['push'] as const,
    deliveryTiming: 'immediate',
    runAt: '2026-05-05T12:00:00.000Z',
    reasonCodes: [] as string[],
    policy: {
      prefKey: 'message.posted',
      critical: false,
      presenceAware: true,
      digestEligible: false,
      defaultDelaySeconds: 0,
    },
    scopeKind: null,
    scopeId: null,
    channelId: 'channel-1',
    threadId: null as string | null,
    recipientAccountId: 'account-1',
    channelLastReadAt: null as string | null,
    threadLastReadAt: null as string | null,
  };

  async function run(overrides: {
    decision?: Partial<typeof baseDecision>;
    eventType?: string;
    routeKind?: string;
    priorUnread?: { id: string } | null;
    threadIdOnPayload?: string;
  }) {
    jest.mocked(sendPushNotification).mockClear();
    jest
      .mocked(buildNotificationDecision)
      .mockResolvedValueOnce({ ...baseDecision, ...overrides.decision } as never);
    const { supabase } = makeSupabase(
      { ...makeEvent(), event_type: overrides.eventType ?? 'message.posted' },
      [],
      [],
      { priorUnreadMessage: overrides.priorUnread ?? null },
    );
    await new NotificationService().deliver({
      supabase: supabase as never,
      job: {
        id: 'job-1',
        org_id: 'org-1',
        payload: {
          activityEventId: 'event-1',
          recipientProfileId: 'profile-1',
          deliveryChannel: 'push',
          prefKey: 'message.posted',
          threadId: overrides.threadIdOnPayload ?? null,
          rawEventPayload: { channelRouteKind: overrides.routeKind },
        },
      } as never,
    });
    return jest.mocked(sendPushNotification).mock.calls[0]?.[0];
  }

  it('sends high priority for the first unread DM message when the recipient is not active', async () => {
    expect(await run({ routeKind: 'dm' })).toHaveProperty('priority', 'high');
  });

  it('sends high priority for the first unread classroom message', async () => {
    expect(await run({ routeKind: 'space' })).toHaveProperty('priority', 'high');
  });

  it('stays at normal priority once the conversation already has unread messages', async () => {
    expect(
      await run({ routeKind: 'dm', priorUnread: { id: 'message-earlier' } }),
    ).not.toHaveProperty('priority');
  });

  it('stays at normal priority when the recipient is active (delivery delayed)', async () => {
    expect(
      await run({ routeKind: 'dm', decision: { deliveryTiming: 'delayed' } }),
    ).not.toHaveProperty('priority');
  });

  it('does not apply to generic channels', async () => {
    expect(await run({ routeKind: 'channel' })).not.toHaveProperty('priority');
  });

  it('does not apply when the channel route is unknown', async () => {
    const out = await run({ routeKind: undefined, decision: {} });
    expect(out).not.toHaveProperty('priority');
  });

  it('scopes first-unread to the thread for thread replies', async () => {
    expect(
      await run({
        eventType: 'message.thread_reply.posted',
        routeKind: 'space',
        threadIdOnPayload: 'thread-1',
        decision: { threadId: 'thread-1', prefKey: 'message.thread_reply.posted' },
      }),
    ).toHaveProperty('priority', 'high');
  });
});

describe('NotificationService completion push policy', () => {
  it.each([
    'session.feedback_request.sent',
    'session.completion_check.sent',
    'session.completion_check.batch.sent',
  ])('does not enqueue or send queued pushes for %s', async (eventType) => {
    jest.mocked(sendPushNotification).mockClear();
    const realDecision = jest.requireActual<
      typeof import('@iconicedu/api/lib/notifications/decision-engine')
    >('@iconicedu/api/lib/notifications/decision-engine').buildNotificationDecision;
    jest
      .mocked(buildNotificationDecision)
      .mockImplementationOnce(realDecision)
      .mockImplementationOnce(realDecision);
    const { supabase, rpc } = makeSupabase({ ...makeEvent(), event_type: eventType });
    const service = new NotificationService();
    await service.prepareForActivityEvent({
      supabase: supabase as never,
      eventId: 'event-1',
      recipientProfileIds: ['profile-1'],
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'enqueue_event_pipeline_job',
      expect.objectContaining({
        p_payload: expect.objectContaining({ deliveryChannel: 'email' }),
      }),
    );
    await expect(
      service.deliver({
        supabase: supabase as never,
        job: {
          id: 'queued-before-policy-change',
          org_id: 'org-1',
          payload: {
            activityEventId: 'event-1',
            recipientProfileId: 'profile-1',
            deliveryChannel: 'push',
            prefKey: eventType,
          },
        } as never,
      }),
    ).resolves.toMatchObject({ suppressed: true, reason: 'no_longer_eligible' });
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});

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

  it('does not truncate personalized queued notification summaries', async () => {
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
    expect(payload!.summary).toHaveLength(160);
    expect(payload!.summary).not.toMatch(/\.\.\.$/);
  });

  it('enriches reminder notification copy with recipient timezone and activity context', async () => {
    const { supabase, rpc } = makeSupabase(
      {
        ...makeEvent({
          title: 'Algebra',
          startAt: '2030-03-06T14:00:00.000Z',
          timezone: 'UTC',
          members: [
            {
              profileId: 'student-1',
              role: 'child',
              displayName: 'Priya',
            },
            {
              profileId: 'teacher-1',
              role: 'educator',
              displayName: 'Ms. Chen',
            },
          ],
        }),
        event_type: 'session.reminder.sent',
      },
      [
        {
          id: 'guardian-1',
          account_id: 'guardian-account-1',
          kind: 'guardian',
          display_name: 'Anika Rao',
          timezone: 'America/New_York',
        },
        {
          id: 'student-1',
          account_id: 'student-account-1',
          kind: 'child',
          display_name: 'Priya',
        },
        {
          id: 'teacher-1',
          account_id: 'teacher-account-1',
          kind: 'educator',
          display_name: 'Ms. Chen',
        },
      ],
      [
        {
          guardian_account_id: 'guardian-account-1',
          child_account_id: 'student-account-1',
        },
      ],
    );
    const service = new NotificationService();

    await service.prepareForActivityEvent({
      supabase: supabase as never,
      eventId: 'event-1',
      recipientProfileIds: ['guardian-1'],
    });

    const payload = rpc.mock.calls[0]?.[1]?.p_payload as
      | Record<string, unknown>
      | undefined;
    expect(payload?.title).toBe('Algebra for Priya with Ms. Chen');
    expect(payload?.summary).toContain('Class session starts');
    expect(payload?.summary).toContain('EST');
    expect(payload?.summary).toContain('Algebra for Priya with Ms. Chen');
    expect(payload?.rawEventPayload).toMatchObject({
      viewerTimezone: 'America/New_York',
      recipientTimezone: 'America/New_York',
      viewerRole: 'guardian',
      activityContext: {
        teacherNames: ['Ms. Chen'],
        studentNames: ['Priya'],
        viewerStudentNames: ['Priya'],
      },
    });
  });
  it('enqueues separate push jobs for three class reminders with stable retry identities', async () => {
    const service = new NotificationService();
    const keys = new Set<string>();
    for (const index of [1, 2, 3]) {
      const event = {
        ...makeEvent(),
        id: `event-${index}`,
        event_type: 'session.reminder.sent',
      };
      const { supabase, rpc } = makeSupabase(event);
      for (const attempt of [1, 2]) {
        await service.prepareForActivityEvent({
          supabase: supabase as never,
          eventId: event.id,
          recipientProfileIds: ['teacher-1'],
        });
        expect(rpc.mock.calls[attempt - 1]?.[1]?.p_dedupe_key).toBe(
          `notification.deliver:event-${index}:teacher-1:push`,
        );
      }
      keys.add(rpc.mock.calls[0]![1].p_dedupe_key);
    }
    expect(keys.size).toBe(3);
  });
});
