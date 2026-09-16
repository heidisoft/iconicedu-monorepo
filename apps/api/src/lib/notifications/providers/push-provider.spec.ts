import { buildReminderPushCollapseId } from '@iconicedu/api/lib/notifications/push-collapse';
import { sendPushNotification } from '@iconicedu/api/lib/notifications/providers/push-provider';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe('sendPushNotification', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  function mockSupabaseWithActiveToken() {
    const pushTokensChain = {
      select: jest.fn(() => pushTokensChain),
      eq: jest.fn(() => pushTokensChain),
      is: jest.fn(async () => ({
        data: [{ id: 'token-1', token: 'ExponentPushToken[test]' }],
        error: null,
      })),
    };
    const profilesChain = {
      select: jest.fn(() => profilesChain),
      eq: jest.fn(() => profilesChain),
      single: jest.fn(async () => ({
        data: { account_id: 'account-1' },
        error: null,
      })),
    };
    const readStateChain = {
      select: jest.fn(() => readStateChain),
      eq: jest.fn(() => readStateChain),
      is: jest.fn(async () => ({
        data: [],
        error: null,
      })),
    };

    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'push_tokens') return pushTokensChain;
        if (table === 'profiles') return profilesChain;
        if (table === 'channel_read_state') return readStateChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);
  }

  function sentMessages() {
    return JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Array<{
      body?: string;
      priority?: string;
      collapseId?: string;
    }>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as never;
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn(async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] })),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([undefined, 'high'] as const)(
    'sends priority %s and preserves the visible push body',
    async (priority) => {
      const longSummary =
        'Class session starts today at 4:00 PM EST · Advanced Algebra foundations and problem solving for Priya, Maya, and Sanvi with Ms. Chen and Mr. Patel';
      mockSupabaseWithActiveToken();

      await sendPushNotification({
        orgId: 'org-1',
        recipientProfileId: 'profile-1',
        prefKey: 'session.reminder.sent',
        title: 'Algebra for Priya and Maya with Ms. Chen',
        summary: longSummary,
        priority,
      });

      const messages = sentMessages();
      expect(messages[0]?.body).toBe(longSummary);
      if (priority) expect(messages[0]?.priority).toBe('high');
      else expect(messages[0]).not.toHaveProperty('priority');
    },
  );

  it('collapses a reminder push onto its reminder dedupe key', async () => {
    const reminderDedupeKey =
      'session.reminder:org-1:space-1:channel-1:2030-03-06T10:00:00.000Z:30';
    mockSupabaseWithActiveToken();

    await sendPushNotification({
      orgId: 'org-1',
      recipientProfileId: 'profile-1',
      prefKey: 'session.reminder.sent',
      title: 'Algebra starts in 30 minutes',
      summary: 'Class starts in 30 minutes',
      metadata: { rawEventPayload: { reminderDedupeKey } },
    });

    expect(sentMessages()[0]?.collapseId).toBe(
      buildReminderPushCollapseId(reminderDedupeKey),
    );
  });

  it('omits collapseId for pushes without a reminder dedupe key', async () => {
    mockSupabaseWithActiveToken();

    await sendPushNotification({
      orgId: 'org-1',
      recipientProfileId: 'profile-1',
      prefKey: 'message.posted',
      title: 'Ms. Chen',
      summary: 'See you in class',
      metadata: { rawEventPayload: { content: 'See you in class' } },
    });

    expect(sentMessages()[0]).not.toHaveProperty('collapseId');
  });
});
