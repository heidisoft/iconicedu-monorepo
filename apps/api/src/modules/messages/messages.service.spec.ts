import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

type ResolveThreadContextInput = {
  accessToken: string;
  orgId: string;
  channelId: string;
  currentProfile: {
    id: string;
    org_id: string;
    account_id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    avatar_seed: string | null;
    kind: string | null;
  };
  requestedThreadId?: string | null;
  threadParentId?: string | null;
  now: string;
};

type ResolveThreadContextResult = {
  threadId: string | null;
  threadCreated: boolean;
};

type ResolveThreadContextService = {
  resolveThreadContext: (
    input: ResolveThreadContextInput,
  ) => Promise<ResolveThreadContextResult>;
};

function makeChain<T>(result: { data: T; error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => result),
  };
  return chain;
}

function makeInsertChain<T>(result: { data: T; error: null }) {
  const chain = {
    insert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn(async () => result),
  };
  return chain;
}

function makeUpdateChain(result: { error: null }) {
  const chain = {
    update: jest.fn(() => chain),
    eq: jest.fn(async () => result),
  };
  return chain;
}

describe('MessagesService.resolveThreadContext', () => {
  const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);
  const createSupabaseSessionClientMock = jest.mocked(createSupabaseSessionClient);
  const input: ResolveThreadContextInput = {
    accessToken: 'session-token',
    orgId: 'org-1',
    channelId: 'channel-1',
    currentProfile: {
      id: 'sender-profile-1',
      org_id: 'org-1',
      account_id: 'account-1',
      display_name: 'Sender',
      first_name: null,
      last_name: null,
      avatar_url: null,
      avatar_seed: null,
      kind: 'student',
    },
    requestedThreadId: 'client-thread-1',
    threadParentId: 'parent-message-1',
    now: '2030-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function callResolveThreadContext(overrides?: Partial<ResolveThreadContextInput>) {
    return (
      new MessagesService() as unknown as ResolveThreadContextService
    ).resolveThreadContext({
      ...input,
      ...overrides,
    });
  }

  it('creates a server thread when the requested thread id does not exist', async () => {
    const parentMessageChain = makeChain({
      data: {
        id: 'parent-message-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        sender_profile_id: 'parent-profile-1',
        thread_id: null,
        type: 'text',
      },
      error: null,
    });
    const parentPayloadChain = makeChain({
      data: { payload: { text: 'Parent text' } },
      error: null,
    });
    const parentProfileChain = makeChain({
      data: {
        display_name: 'Parent',
        first_name: null,
        last_name: null,
      },
      error: null,
    });
    const requestedThreadChain = makeChain({ data: null, error: null });
    const threadInsertChain = makeInsertChain({
      data: { id: 'server-thread-1' },
      error: null,
    });
    const parentUpdateChain = makeUpdateChain({ error: null });
    const participantUpsert = jest.fn(async () => ({ error: null }));

    createSupabaseSessionClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'messages') return parentMessageChain;
        if (table === 'message_text') return parentPayloadChain;
        if (table === 'profiles') return parentProfileChain;
        throw new Error(`Unexpected session table ${table}`);
      }),
    } as never);
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'threads') {
          return requestedThreadChain.maybeSingle.mock.calls.length === 0
            ? requestedThreadChain
            : threadInsertChain;
        }
        if (table === 'messages') return parentUpdateChain;
        if (table === 'thread_participants') {
          return { upsert: participantUpsert };
        }
        throw new Error(`Unexpected service table ${table}`);
      }),
    } as never);

    const result = await callResolveThreadContext();

    expect(result).toEqual({ threadId: 'server-thread-1', threadCreated: true });
    expect(participantUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          thread_id: 'server-thread-1',
          profile_id: 'parent-profile-1',
        }),
        expect.objectContaining({
          thread_id: 'server-thread-1',
          profile_id: 'sender-profile-1',
        }),
      ]),
      { onConflict: 'org_id,thread_id,profile_id' },
    );
  });

  it('uses a requested thread only when it belongs to the same parent message', async () => {
    const parentMessageChain = makeChain({
      data: {
        id: 'parent-message-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        sender_profile_id: 'parent-profile-1',
        thread_id: null,
        type: 'text',
      },
      error: null,
    });
    const requestedThreadChain = makeChain({
      data: {
        id: 'client-thread-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        parent_message_id: 'parent-message-1',
      },
      error: null,
    });
    const participantUpsert = jest.fn(async () => ({ error: null }));

    createSupabaseSessionClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'messages') return parentMessageChain;
        throw new Error(`Unexpected session table ${table}`);
      }),
    } as never);
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'threads') return requestedThreadChain;
        if (table === 'thread_participants') {
          return { upsert: participantUpsert };
        }
        throw new Error(`Unexpected service table ${table}`);
      }),
    } as never);

    const result = await callResolveThreadContext();

    expect(result).toEqual({ threadId: 'client-thread-1', threadCreated: false });
    expect(requestedThreadChain.eq).toHaveBeenCalledWith(
      'parent_message_id',
      'parent-message-1',
    );
    expect(participantUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          thread_id: 'client-thread-1',
          profile_id: 'parent-profile-1',
        }),
        expect.objectContaining({
          thread_id: 'client-thread-1',
          profile_id: 'sender-profile-1',
        }),
      ]),
      { onConflict: 'org_id,thread_id,profile_id' },
    );
  });
});
