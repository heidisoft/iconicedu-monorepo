import { sendPushNotification } from '@iconicedu/api/lib/notifications/providers/push-provider';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

describe('sendPushNotification', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('does not truncate the visible push body summary', async () => {
    const longSummary =
      'Class session starts today at 4:00 PM EST · Advanced Algebra foundations and problem solving for Priya, Maya, and Sanvi with Ms. Chen and Mr. Patel';
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
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn(async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] })),
    });

    await sendPushNotification({
      orgId: 'org-1',
      recipientProfileId: 'profile-1',
      prefKey: 'session.reminder.sent',
      title: 'Algebra for Priya and Maya with Ms. Chen',
      summary: longSummary,
    });

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Array<{
      body?: string;
    }>;
    expect(body[0]?.body).toBe(longSummary);
  });
});
