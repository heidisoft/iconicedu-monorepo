import { ScheduledMessagesService } from './scheduled-messages.service';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

function makeChain<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
) {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'in', 'update', 'insert', 'delete', 'order'].forEach(
    (method) => {
      chain[method] = jest.fn(() => chain);
    },
  );
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  (chain as { then: (...args: unknown[]) => Promise<unknown> }).then = (
    resolve,
    reject,
  ) => Promise.resolve(result).then(resolve as never, reject as never);
  return chain;
}

const BASE_ROW = {
  id: 'sched-1',
  org_id: 'org-1',
  channel_id: 'chan-1',
  sender_profile_id: 'profile-1',
  content: 'hello',
  mentions: [],
  thread_parent_id: null,
  thread_id: null,
  send_at: new Date(Date.now() + 60_000).toISOString(),
  timezone: 'America/New_York',
  status: 'pending' as const,
  dispatched_message_id: null,
  attempt_count: 0,
  max_attempts: 5,
  last_error: null,
};

describe('ScheduledMessagesService.dispatchDueScheduledMessages', () => {
  const messagesService = {
    resolveWritableProfile: jest.fn(),
  } as unknown as MessagesService;
  const service = new ScheduledMessagesService(messagesService);

  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest.mocked(createSupabaseSessionClient).mockReset();
  });

  it('sends a claimed message when the sender still has channel access', async () => {
    const profileChain = makeChain({ data: { id: 'profile-1' }, error: null });
    const membershipChain = makeChain({ data: { id: 'member-1' }, error: null });
    const messagesInsertChain = makeChain({ data: { id: 'message-new-1' }, error: null });
    const messageTextInsertChain = makeChain({ data: null, error: null });
    const scheduledUpdateChain = makeChain({
      data: { ...BASE_ROW, status: 'sent', dispatched_message_id: 'message-new-1' },
      error: null,
    });

    const from = jest.fn((table: string) => {
      if (table === 'profiles') return profileChain;
      if (table === 'channel_members') return membershipChain;
      if (table === 'messages') return messagesInsertChain;
      if (table === 'message_text') return messageTextInsertChain;
      if (table === 'scheduled_messages') return scheduledUpdateChain;
      throw new Error(`unexpected table ${table}`);
    });
    const rpc = jest.fn(async () => ({ data: [BASE_ROW], error: null }));
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ from, rpc } as never);

    const result = await service.dispatchDueScheduledMessages({ leaseOwner: 'test' });

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(messagesInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_profile_id: 'profile-1', type: 'text' }),
    );
  });

  it('re-checks authorization at delivery time and fails a row whose sender lost channel access', async () => {
    const profileChain = makeChain({ data: { id: 'profile-1' }, error: null });
    const membershipChain = makeChain({ data: null, error: null }); // no longer a member
    const scheduledFailChain = makeChain({ data: null, error: null });

    const from = jest.fn((table: string) => {
      if (table === 'profiles') return profileChain;
      if (table === 'channel_members') return membershipChain;
      if (table === 'scheduled_messages') return scheduledFailChain;
      throw new Error(`unexpected table ${table} should not be reached`);
    });
    const rpc = jest.fn(async () => ({ data: [BASE_ROW], error: null }));
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ from, rpc } as never);

    const result = await service.dispatchDueScheduledMessages({ leaseOwner: 'test' });

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(scheduledFailChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        // BASE_ROW has attempt_count 0 / max_attempts 5, so this attempt is
        // retryable — it stays pending with a bumped attempt_count, and only
        // flips to 'failed' once attempts are exhausted (separate test below).
        status: 'pending',
        attempt_count: 1,
        last_error: 'Sender no longer has access to this channel',
      }),
    );
  });

  it('re-checks authorization at delivery time and fails a row whose sender was deleted', async () => {
    const profileChain = makeChain({ data: null, error: null }); // deleted / not found
    const scheduledFailChain = makeChain({ data: null, error: null });

    const from = jest.fn((table: string) => {
      if (table === 'profiles') return profileChain;
      if (table === 'scheduled_messages') return scheduledFailChain;
      throw new Error(`unexpected table ${table} should not be reached`);
    });
    const rpc = jest.fn(async () => ({ data: [BASE_ROW], error: null }));
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ from, rpc } as never);

    const result = await service.dispatchDueScheduledMessages({ leaseOwner: 'test' });

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 1 });
  });

  it('marks a row permanently failed once attempts are exhausted, pending otherwise', async () => {
    const exhaustedRow = { ...BASE_ROW, attempt_count: 4, max_attempts: 5 };
    const profileChain = makeChain({ data: null, error: null });
    const scheduledFailChain = makeChain({ data: null, error: null });
    const from = jest.fn((table: string) => {
      if (table === 'profiles') return profileChain;
      if (table === 'scheduled_messages') return scheduledFailChain;
      throw new Error(`unexpected table ${table}`);
    });
    const rpc = jest.fn(async () => ({ data: [exhaustedRow], error: null }));
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ from, rpc } as never);

    await service.dispatchDueScheduledMessages({ leaseOwner: 'test' });

    expect(scheduledFailChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempt_count: 5 }),
    );
  });
});

describe('ScheduledMessagesService.create', () => {
  const resolveWritableProfile = jest.fn();
  const messagesService = { resolveWritableProfile } as unknown as MessagesService;
  const service = new ScheduledMessagesService(messagesService);

  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    resolveWritableProfile.mockReset();
    resolveWritableProfile.mockResolvedValue({
      accountId: 'account-1',
      profile: { id: 'profile-1' },
    });
  });

  it('rejects a sendAt that is not in the future', async () => {
    await expect(
      service.create('auth-user-1', 'token', {
        orgId: 'org-1',
        channelId: 'chan-1',
        senderProfileId: 'profile-1',
        content: 'hi',
        sendAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toThrow('sendAt must be in the future');
  });

  it('rejects empty content', async () => {
    await expect(
      service.create('auth-user-1', 'token', {
        orgId: 'org-1',
        channelId: 'chan-1',
        senderProfileId: 'profile-1',
        content: '   ',
        sendAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).rejects.toThrow('Message text is required');
  });
});
