import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/flags/posthog-openfeature', () => ({
  apiFeatureFlagKeys: { enableMessageEdit: 'enable-message-edit' },
  evaluateApiBooleanFlag: jest.fn(),
}));

/** A thenable, chainable stand-in for a Supabase PostgrestFilterBuilder. */
function makeChain<T>(
  result: { data: T; error: null } | { data: null; error: { message: string } },
) {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'update', 'insert', 'upsert', 'returns'].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  chain.maybeSingle = jest.fn(async () => result);
  chain.single = jest.fn(async () => result);
  (chain as { then: (...args: unknown[]) => Promise<unknown> }).then = (
    resolve,
    reject,
  ) => Promise.resolve(result).then(resolve as never, reject as never);
  return chain;
}

const ORG_ID = 'org-1';
const CHANNEL_ID = 'chan-1';
const SENDER_PROFILE_ID = 'profile-sender';
const AUTH_USER_ID = 'auth-user-1';
const MESSAGE_ID = 'message-1';

function baseMessageRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MESSAGE_ID,
    org_id: ORG_ID,
    channel_id: CHANNEL_ID,
    sender_profile_id: SENDER_PROFILE_ID,
    type: 'text',
    created_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

function setUpServiceClient(input: {
  messageRow: ReturnType<typeof baseMessageRow> | null;
  accountId?: string;
  senderAccountId?: string;
  /** Simulates the is_edited UPDATE matching zero rows (defaults to a single matching row). */
  messagesUpdateMatchedRows?: Array<{ id: string }>;
}) {
  const accountId = input.accountId ?? 'account-1';
  const senderAccountId = input.senderAccountId ?? accountId;

  const messageSelectChain = makeChain({ data: input.messageRow, error: null });
  const accountsChain = makeChain({
    data: { id: accountId, org_id: ORG_ID },
    error: null,
  });
  const profilesChain = makeChain({
    data: {
      id: SENDER_PROFILE_ID,
      org_id: ORG_ID,
      account_id: senderAccountId,
      display_name: 'Sender',
      first_name: null,
      last_name: null,
      avatar_url: null,
      avatar_seed: null,
      kind: 'guardian',
    },
    error: null,
  });
  const familyLinksChain = makeChain({ data: null, error: null });
  const messageTextUpdateChain = makeChain({ data: null, error: null });
  const messagesUpdateChain = makeChain({
    data: input.messagesUpdateMatchedRows ?? [{ id: MESSAGE_ID }],
    error: null,
  });

  let messagesCallCount = 0;
  const from = jest.fn((table: string) => {
    if (table === 'messages') {
      messagesCallCount += 1;
      return messagesCallCount === 1 ? messageSelectChain : messagesUpdateChain;
    }
    if (table === 'accounts') return accountsChain;
    if (table === 'profiles') return profilesChain;
    if (table === 'family_links') return familyLinksChain;
    if (table === 'message_text') return messageTextUpdateChain;
    throw new Error(`Unexpected table access in test: ${table}`);
  });

  jest.mocked(createSupabaseServiceClient).mockReturnValue({ from } as never);
  return { messageTextUpdateChain, messagesUpdateChain };
}

describe('MessagesService.editTextMessage', () => {
  const service = new MessagesService();

  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest.mocked(createSupabaseSessionClient).mockReset();
    jest.mocked(evaluateApiBooleanFlag).mockReset().mockResolvedValue(true);
  });

  it('rejects when the enable-message-edit flag is off', async () => {
    setUpServiceClient({ messageRow: baseMessageRow() });
    jest.mocked(evaluateApiBooleanFlag).mockResolvedValue(false);

    await expect(
      service.editTextMessage(AUTH_USER_ID, 'token', MESSAGE_ID, {
        orgId: ORG_ID,
        messageId: MESSAGE_ID,
        content: 'nope',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates the message_text payload and marks the message edited', async () => {
    const { messageTextUpdateChain, messagesUpdateChain } = setUpServiceClient({
      messageRow: baseMessageRow(),
    });

    const result = await service.editTextMessage(AUTH_USER_ID, 'token', MESSAGE_ID, {
      orgId: ORG_ID,
      messageId: MESSAGE_ID,
      content: 'updated text',
    });

    expect(result).toEqual({ id: MESSAGE_ID });
    expect(messageTextUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { text: 'updated text' },
      }),
    );
    expect(messagesUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_edited: true }),
    );
  });

  it('fails loudly instead of silently when the is_edited update matches no row', async () => {
    setUpServiceClient({
      messageRow: baseMessageRow(),
      messagesUpdateMatchedRows: [],
    });

    await expect(
      service.editTextMessage(AUTH_USER_ID, 'token', MESSAGE_ID, {
        orgId: ORG_ID,
        messageId: MESSAGE_ID,
        content: 'updated text',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects editing a message outside the edit window', async () => {
    setUpServiceClient({
      messageRow: baseMessageRow({
        created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      }),
    });

    await expect(
      service.editTextMessage(AUTH_USER_ID, 'token', MESSAGE_ID, {
        orgId: ORG_ID,
        messageId: MESSAGE_ID,
        content: 'too late',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects editing a non-text message', async () => {
    setUpServiceClient({ messageRow: baseMessageRow({ type: 'image' }) });

    await expect(
      service.editTextMessage(AUTH_USER_ID, 'token', MESSAGE_ID, {
        orgId: ORG_ID,
        messageId: MESSAGE_ID,
        content: 'nope',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects editing a deleted message', async () => {
    setUpServiceClient({
      messageRow: baseMessageRow({ deleted_at: new Date().toISOString() }),
    });

    await expect(
      service.editTextMessage(AUTH_USER_ID, 'token', MESSAGE_ID, {
        orgId: ORG_ID,
        messageId: MESSAGE_ID,
        content: 'nope',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the message does not belong to the given org', async () => {
    setUpServiceClient({ messageRow: baseMessageRow({ org_id: 'other-org' }) });

    await expect(
      service.editTextMessage(AUTH_USER_ID, 'token', MESSAGE_ID, {
        orgId: ORG_ID,
        messageId: MESSAGE_ID,
        content: 'nope',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when the acting account cannot write as the sender profile', async () => {
    setUpServiceClient({
      messageRow: baseMessageRow(),
      accountId: 'account-1',
      senderAccountId: 'account-2',
    });

    await expect(
      service.editTextMessage(AUTH_USER_ID, 'token', MESSAGE_ID, {
        orgId: ORG_ID,
        messageId: MESSAGE_ID,
        content: 'nope',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
