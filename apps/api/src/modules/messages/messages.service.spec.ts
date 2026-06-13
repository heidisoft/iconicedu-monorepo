import {
  MessagesService,
  resolveChannelWriteAccessForMessage,
} from '@iconicedu/api/modules/messages/messages.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { ForbiddenException } from '@nestjs/common';

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

function makeAccessChain<T>(result: { data: T; error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    is: jest.fn(() => chain),
    limit: jest.fn(() => chain),
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

describe('resolveChannelWriteAccessForMessage', () => {
  function makeSupabase(input: {
    membership?: { id: string } | null;
    userRole?: { id: string } | null;
    primaryRoleAccount?: { id: string } | null;
  }) {
    const membershipChain = makeAccessChain({
      data: input.membership ?? null,
      error: null,
    });
    const userRoleChain = makeAccessChain({
      data: input.userRole ?? null,
      error: null,
    });
    const accountChain = makeAccessChain({
      data: input.primaryRoleAccount ?? null,
      error: null,
    });

    return {
      chains: { membershipChain, userRoleChain, accountChain },
      supabase: {
        from: jest.fn((table: string) => {
          if (table === 'channel_members') return membershipChain;
          if (table === 'user_roles') return userRoleChain;
          if (table === 'accounts') return accountChain;
          throw new Error(`Unexpected table ${table}`);
        }),
      },
    };
  }

  const baseInput = {
    orgId: 'org-1',
    channelId: 'channel-1',
    accountId: 'account-1',
    profileId: 'profile-1',
    profileKind: 'guardian',
  };

  it('allows a staff profile to post in a classroom without ensuring membership', async () => {
    const { supabase, chains } = makeSupabase({ membership: null });

    const result = await resolveChannelWriteAccessForMessage({
      serviceSupabase: supabase as never,
      activityContext: {
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        channelRouteKind: 'space',
        channelPurpose: 'learning-space',
        channelVisibility: 'private',
      },
      ...baseInput,
      profileKind: 'staff',
    });

    expect(result).toEqual({ shouldEnsureMembership: false });
    expect(chains.membershipChain.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
    expect(supabase.from).not.toHaveBeenCalledWith('user_roles');
  });

  it('allows an admin role to post in a classroom without ensuring membership', async () => {
    const { supabase, chains } = makeSupabase({
      membership: null,
      userRole: { id: 'role-1' },
    });

    const result = await resolveChannelWriteAccessForMessage({
      serviceSupabase: supabase as never,
      activityContext: {
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        channelRouteKind: 'space',
        channelPurpose: 'learning-space',
        channelVisibility: 'private',
      },
      ...baseInput,
    });

    expect(result).toEqual({ shouldEnsureMembership: false });
    expect(chains.userRoleChain.in).toHaveBeenCalledWith('role_key', [
      'owner',
      'admin',
      'staff',
    ]);
  });

  it('keeps support-channel posting behavior membership-seeding eligible', async () => {
    const { supabase } = makeSupabase({ membership: null });

    const result = await resolveChannelWriteAccessForMessage({
      serviceSupabase: supabase as never,
      activityContext: {
        scope: { kind: 'channel', channelId: 'support-channel-1' },
        channelRouteKind: 'channel',
        channelPurpose: 'support',
        channelVisibility: 'private',
      },
      ...baseInput,
    });

    expect(result).toEqual({ shouldEnsureMembership: true });
    expect(supabase.from).not.toHaveBeenCalledWith('user_roles');
  });

  it('rejects a private classroom post from a non-member without an operational role', async () => {
    const { supabase } = makeSupabase({
      membership: null,
      userRole: null,
      primaryRoleAccount: null,
    });

    await expect(
      resolveChannelWriteAccessForMessage({
        serviceSupabase: supabase as never,
        activityContext: {
          scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
          channelRouteKind: 'space',
          channelPurpose: 'learning-space',
          channelVisibility: 'private',
        },
        ...baseInput,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
