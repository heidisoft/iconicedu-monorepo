import { InternalServerErrorException } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ThreadsService } from '@iconicedu/api/modules/threads/threads.service';

// ─── Supabase client mocks ────────────────────────────────────────────────────

const mockRpc = jest.fn();
const mockMaybeSingle = jest.fn();

// Build a fluent chain that returns `mockMaybeSingle` at the leaf.
function makeChain() {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['from', 'select', 'eq', 'in', 'is', 'order', 'limit'];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain['maybeSingle'] = mockMaybeSingle;
  return chain;
}

const sessionChain = makeChain();
const serviceChain = makeChain();

const mockAuthGetUser = jest.fn();
const mockSessionClient = {
  ...sessionChain,
  auth: { getUser: mockAuthGetUser },
};
const mockServiceClient = {
  ...serviceChain,
  rpc: mockRpc,
};

jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(() => mockSessionClient),
}));
jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(() => mockServiceClient),
}));

// PrismaService is injected but not used by markRead.
jest.mock('@iconicedu/api/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  orgId: 'org-1',
  accountId: 'child-acct-1',
  profileId: 'child-profile-1',
  channelId: 'channel-1',
};

function makeService() {
  // PrismaService is unused in these read-state tests.
  return new ChannelsService({} as never, new ThreadsService());
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChannelsService.getChannelMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const sessionMethods = ['from', 'select', 'eq', 'in', 'is', 'order', 'limit'];
    for (const m of sessionMethods) {
      (mockSessionClient as Record<string, jest.Mock>)[m].mockReturnValue(
        mockSessionClient,
      );
    }
    const serviceMethods = ['from', 'select', 'eq', 'in', 'is', 'order', 'limit'];
    for (const m of serviceMethods) {
      (mockServiceClient as Record<string, jest.Mock>)[m].mockReturnValue(
        mockServiceClient,
      );
    }
    mockServiceClient.rpc.mockReturnValue(mockServiceClient);
  });

  it('returns classroom participants for staff observers who are not members', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { learning_space_id: 'space-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { account_id: 'staff-account-1', kind: 'staff' },
        error: null,
      });

    mockServiceClient.order.mockResolvedValueOnce({ data: [], error: null });
    mockServiceClient.is
      .mockReturnValueOnce(mockServiceClient)
      .mockReturnValueOnce(mockServiceClient)
      .mockReturnValueOnce(mockServiceClient)
      .mockResolvedValueOnce({
        data: [
          {
            profile_id: 'educator-profile-1',
            profile: {
              account_id: 'educator-account-1',
              display_name: 'Tutor Jane',
              first_name: null,
              last_name: null,
              avatar_seed: 'jane-seed',
              kind: 'educator',
              bio: null,
              timezone: 'America/New_York',
              ui_theme_key: 'teal',
            },
          },
          {
            profile_id: 'student-profile-1',
            profile: {
              account_id: 'student-account-1',
              display_name: 'Avery Student',
              first_name: null,
              last_name: null,
              avatar_seed: 'avery-seed',
              kind: 'child',
              bio: null,
              timezone: null,
              ui_theme_key: 'coral',
            },
          },
        ],
        error: null,
      });

    const svc = makeService();
    const result = await svc.getChannelMembers('staff-token', {
      orgId: BASE_INPUT.orgId,
      channelId: BASE_INPUT.channelId,
      profileId: 'staff-profile-1',
    });

    expect(result.map((member) => member.name)).toEqual(['Avery Student', 'Tutor Jane']);
    expect(result[0]).toMatchObject({
      id: 'student-profile-1',
      role: 'child',
      themeKey: 'coral',
    });
    expect(mockServiceClient.from).toHaveBeenCalledWith('learning_space_participants');
  });
});

describe('ChannelsService.markRead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset every chain method to return the chain itself by default.
    const sessionMethods = ['from', 'select', 'eq', 'in', 'is', 'order', 'limit'];
    for (const m of sessionMethods) {
      (mockSessionClient as Record<string, jest.Mock>)[m].mockReturnValue(
        mockSessionClient,
      );
    }
    const serviceMethods = ['from', 'select', 'eq', 'in', 'is', 'order', 'limit'];
    for (const m of serviceMethods) {
      (mockServiceClient as Record<string, jest.Mock>)[m].mockReturnValue(
        mockServiceClient,
      );
    }
    mockServiceClient.rpc.mockReturnValue(mockServiceClient);
  });

  describe('direct member (own profile, session can see membership)', () => {
    it('calls recompute_unread_for_account_channel and returns unreadCount', async () => {
      // Session membership found → skip guardian path.
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null }) // membership
        .mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null }); // latest message

      mockRpc.mockResolvedValueOnce({ data: 2, error: null });

      const svc = makeService();
      const result = await svc.markRead('token', BASE_INPUT);

      expect(result).toEqual({ unreadCount: 2 });
      expect(mockRpc).toHaveBeenCalledWith(
        'recompute_unread_for_account_channel',
        expect.objectContaining({
          p_account_id: BASE_INPUT.accountId,
          p_channel_id: BASE_INPUT.channelId,
        }),
      );
    });
  });

  describe('guardian acting as child (session RLS blocks membership)', () => {
    beforeEach(() => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: 'guardian-auth-uid' } },
        error: null,
      });
    });

    it('resolves family link and calls recompute_unread_for_account_channel', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: null, error: null }) // session membership → null (RLS)
        .mockResolvedValueOnce({ data: { id: 'guardian-acct-1' }, error: null }) // guardian account
        .mockResolvedValueOnce({ data: { account_id: 'child-acct-1' }, error: null }) // child profile
        .mockResolvedValueOnce({ data: { id: 'family-link-1' }, error: null }) // family_links
        .mockResolvedValueOnce({ data: { id: 'svc-member-1' }, error: null }) // service membership
        .mockResolvedValueOnce({ data: { id: 'msg-99' }, error: null }); // latest message

      mockRpc.mockResolvedValueOnce({ data: 0, error: null });

      const svc = makeService();
      const result = await svc.markRead('guardian-token', BASE_INPUT);

      expect(result).toEqual({ unreadCount: 0 });
      expect(mockRpc).toHaveBeenCalledWith(
        'recompute_unread_for_account_channel',
        expect.objectContaining({
          p_account_id: 'child-acct-1',
          p_actor_profile_id: 'child-profile-1',
        }),
      );
    });

    it('returns { unreadCount: 0 } when family link is absent (unauthorized caller)', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: null, error: null }) // session membership → null
        .mockResolvedValueOnce({ data: { id: 'some-acct' }, error: null }) // guardian account
        .mockResolvedValueOnce({ data: { account_id: 'child-acct-1' }, error: null }) // child profile
        .mockResolvedValueOnce({ data: null, error: null }); // family_links → not found

      const svc = makeService();
      const result = await svc.markRead('unknown-token', BASE_INPUT);

      expect(result).toEqual({ unreadCount: 0 });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('returns { unreadCount: 0 } when auth.getUser() fails', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null }); // membership → null
      mockAuthGetUser.mockResolvedValueOnce({
        data: null,
        error: new Error('auth error'),
      });

      const svc = makeService();
      const result = await svc.markRead('bad-token', BASE_INPUT);

      expect(result).toEqual({ unreadCount: 0 });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('returns { unreadCount: 0 } when child is not actually in the channel', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'guardian-acct-1' }, error: null })
        .mockResolvedValueOnce({ data: { account_id: 'child-acct-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'family-link-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null }); // service membership → not found

      const svc = makeService();
      const result = await svc.markRead('guardian-token', BASE_INPUT);

      expect(result).toEqual({ unreadCount: 0 });
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('throws InternalServerErrorException when membership lookup returns an error', async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'db error' },
      });

      const svc = makeService();
      await expect(svc.markRead('token', BASE_INPUT)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when RPC fails', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null });

      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc error' } });

      const svc = makeService();
      await expect(svc.markRead('token', BASE_INPUT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('no messages in channel', () => {
    it('returns { unreadCount: 0 } without calling RPC', async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null }) // membership
        .mockResolvedValueOnce({ data: null, error: null }); // latest message → none

      const svc = makeService();
      const result = await svc.markRead('token', BASE_INPUT);

      expect(result).toEqual({ unreadCount: 0 });
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});

describe('ChannelsService.markReadState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const sessionMethods = ['from', 'select', 'eq', 'in', 'is', 'order', 'limit'];
    for (const m of sessionMethods) {
      (mockSessionClient as Record<string, jest.Mock>)[m].mockReturnValue(
        mockSessionClient,
      );
    }
    const serviceMethods = ['from', 'select', 'eq', 'in', 'is', 'order', 'limit'];
    for (const m of serviceMethods) {
      (mockServiceClient as Record<string, jest.Mock>)[m].mockReturnValue(
        mockServiceClient,
      );
    }
    mockServiceClient.rpc.mockReturnValue(mockServiceClient);
  });

  it('uses the channel unread recompute path when threadId is absent', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: 'member-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null });
    mockRpc.mockResolvedValueOnce({ data: 0, error: null });

    const svc = makeService();
    const result = await svc.markReadState('token', {
      ...BASE_INPUT,
      lastReadMessageId: 'msg-1',
    });

    expect(result).toEqual({ unreadCount: 0 });
    expect(mockRpc).toHaveBeenCalledWith(
      'recompute_unread_for_account_channel',
      expect.objectContaining({
        p_channel_id: BASE_INPUT.channelId,
        p_last_read_message_id: 'msg-1',
      }),
    );
  });

  it('uses the thread unread recompute path when threadId is present', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: 'thread-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'participant-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'reply-1' }, error: null });
    mockRpc.mockResolvedValueOnce({ data: 0, error: null });

    const svc = makeService();
    const result = await svc.markReadState('token', {
      ...BASE_INPUT,
      threadId: 'thread-1',
      lastReadMessageId: 'reply-1',
    });

    expect(result).toEqual({ unreadCount: 0 });
    expect(mockRpc).toHaveBeenCalledWith(
      'recompute_unread_for_account_thread',
      expect.objectContaining({
        p_channel_id: BASE_INPUT.channelId,
        p_thread_id: 'thread-1',
        p_last_read_message_id: 'reply-1',
      }),
    );
  });
});
