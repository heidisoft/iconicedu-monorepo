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

function makeSupabase(
  event: Record<string, unknown>,
  profiles: Array<Record<string, unknown>> = [],
  familyLinks: Array<{
    guardian_account_id: string;
    child_account_id: string;
  }> = [],
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
        in: jest.fn((column: string, value: unknown) => {
          filters.set(column, value);
          return query;
        }),
        is: jest.fn(() => query),
        maybeSingle: jest.fn(async () => {
          if (table === 'activity_events') {
            return { data: event, error: null };
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
});
