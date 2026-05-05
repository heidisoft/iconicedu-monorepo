import { buildNotificationDecision } from './decision-engine';
import { resolveEffectivePreference } from './resolve-effective-preference';

jest.mock('@iconicedu/api/lib/notifications/resolve-effective-preference', () => ({
  resolveEffectivePreference: jest.fn(async () => ({
    source: 'org_default',
    muted: false,
    channels: ['push'],
    scopeKind: 'org',
    scopeId: 'org-1',
  })),
}));

type FilterMap = Record<string, unknown>;

function createSupabaseMock(options: {
  channelLastReadAt?: string | null;
  threadLastReadAt?: string | null;
}) {
  const channelReadFilters: FilterMap[] = [];

  return {
    channelReadFilters,
    client: {
      from(table: string) {
        const filters: FilterMap = {};
        const chain = {
          select() {
            return chain;
          },
          eq(column: string, value: unknown) {
            filters[column] = value;
            return chain;
          },
          is(column: string, value: unknown) {
            filters[column] = value;
            return chain;
          },
          maybeSingle() {
            if (table === 'profiles') {
              return Promise.resolve({
                data: { account_id: 'account-1' },
                error: null,
              });
            }

            if (table === 'profile_presence') {
              return Promise.resolve({
                data: {
                  live_status: 'offline',
                  last_seen_at: '2026-04-21T11:00:00.000Z',
                },
                error: null,
              });
            }

            if (table === 'channel_read_state') {
              channelReadFilters.push({ ...filters });
              const lastReadAt =
                typeof filters['thread_id'] === 'string'
                  ? (options.threadLastReadAt ?? null)
                  : (options.channelLastReadAt ?? null);

              return Promise.resolve({
                data: lastReadAt ? { last_read_at: lastReadAt } : null,
                error: null,
              });
            }

            return Promise.resolve({ data: null, error: null });
          },
        };

        return chain;
      },
    },
  };
}

describe('buildNotificationDecision', () => {
  const resolveEffectivePreferenceMock = jest.mocked(resolveEffectivePreference);

  beforeEach(() => {
    resolveEffectivePreferenceMock.mockClear();
  });

  it('suppresses external delivery when the source event requests silent notifications', async () => {
    const { client } = createSupabaseMock({
      channelLastReadAt: null,
      threadLastReadAt: null,
    });

    const result = await buildNotificationDecision({
      supabase: client as never,
      event: {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'class.session.rescheduled',
        occurred_at: '2026-04-21T11:59:30.000Z',
        payload: { suppressNotifications: true },
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      } as never,
      recipientProfileId: 'profile-1',
    });

    expect(result.deliveryChannels).toEqual([]);
    expect(result.reasonCodes).toEqual(['source_suppressed']);
    expect(resolveEffectivePreferenceMock).not.toHaveBeenCalled();
  });

  it('queries thread-level read state for thread reply events', async () => {
    const { client, channelReadFilters } = createSupabaseMock({
      channelLastReadAt: '2026-04-21T11:59:00.000Z',
      threadLastReadAt: '2026-04-21T11:59:59.000Z',
    });

    const result = await buildNotificationDecision({
      supabase: client as never,
      event: {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'message.posted',
        occurred_at: '2026-04-21T11:59:30.000Z',
        payload: { mentionedProfileId: null, threadId: 'thread-1' },
        scope: { kind: 'channel', channelId: 'channel-1' },
      } as never,
      recipientProfileId: 'profile-1',
    });

    expect(channelReadFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ thread_id: null }),
        expect.objectContaining({ thread_id: 'thread-1' }),
      ]),
    );
    expect(result.deliveryTiming).toBe('delayed');
    expect(result.reasonCodes).toContain('channel_recently_read');
    expect(resolveEffectivePreferenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultChannels: ['push'],
        prefKey: 'message.posted',
      }),
    );
  });

  it('uses the freshest of channel and thread read state timestamps', async () => {
    const { client } = createSupabaseMock({
      channelLastReadAt: '2026-04-21T11:59:50.000Z',
      threadLastReadAt: '2026-04-21T11:59:20.000Z',
    });

    const result = await buildNotificationDecision({
      supabase: client as never,
      event: {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'message.posted',
        occurred_at: '2026-04-21T11:59:30.000Z',
        payload: { threadId: 'thread-1' },
        scope: { kind: 'channel', channelId: 'channel-1' },
      } as never,
      recipientProfileId: 'profile-1',
    });

    expect(result.deliveryTiming).toBe('delayed');
    expect(result.reasonCodes).toContain('channel_recently_read');
  });

  it('uses immediate critical policy and push/email defaults for session reminders', async () => {
    const { client } = createSupabaseMock({
      channelLastReadAt: null,
      threadLastReadAt: null,
    });

    const result = await buildNotificationDecision({
      supabase: client as never,
      event: {
        id: 'event-1',
        org_id: 'org-1',
        event_type: 'session.reminder.sent',
        occurred_at: '2026-04-21T11:59:30.000Z',
        payload: { channelId: 'channel-1' },
        scope: { kind: 'channel', channelId: 'channel-1' },
      } as never,
      recipientProfileId: 'profile-1',
    });

    expect(result.policy).toMatchObject({
      prefKey: 'session.reminder.sent',
      critical: true,
      defaultDelaySeconds: 0,
    });
    expect(result.deliveryTiming).toBe('immediate');
    expect(resolveEffectivePreferenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultChannels: ['push', 'email'],
        prefKey: 'session.reminder.sent',
      }),
    );
  });
});
