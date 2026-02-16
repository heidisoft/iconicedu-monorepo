import { describe, expect, it, vi } from 'vitest';

import { deleteMessageAction, sendTextMessageAction } from '@iconicedu/web/app/actions/messages';

const mapMessageRowToVM = vi.fn();
const buildUserProfileById = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user' })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({ data: { id: 'account-1', org_id: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(async () => ({ data: { id: 'profile-1' } })),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileById: (...args: unknown[]) => buildUserProfileById(...args),
}));

vi.mock('@iconicedu/web/lib/messages/mappers/message.mapper', () => ({
  mapMessageRowToVM: (...args: unknown[]) => mapMessageRowToVM(...args),
}));

vi.mock('@iconicedu/web/lib/messages/builders/thread.builder', () => ({
  buildThreadById: vi.fn(async () => ({ ids: { id: 'thread-1', orgId: 'org-1' } })),
}));

describe('sendTextMessageAction', () => {
  it('creates a text message and returns the mapped VM', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } = await import(
      '@iconicedu/web/lib/supabase/server'
    );
    (createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      supabase,
    );
    const insertMessage = vi.fn();
    const insertMessageText = vi.fn();
    const messageRow = {
      id: 'message-1',
      org_id: 'org-1',
      channel_id: 'channel-1',
      sender_profile_id: 'profile-1',
      type: 'text',
      created_at: new Date().toISOString(),
    };

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        insertMessage.mockReturnValue({
          select: () => ({
            single: async () => ({ data: messageRow, error: null }),
          }),
        });
        return { insert: insertMessage };
      }
      if (table === 'message_text') {
        insertMessageText.mockResolvedValue({ error: null });
        return { insert: insertMessageText };
      }
      return { insert: vi.fn() };
    });

    buildUserProfileById.mockResolvedValueOnce({ ids: { id: 'profile-1', orgId: 'org-1' } });
    mapMessageRowToVM.mockReturnValueOnce({ ids: { id: 'message-1', orgId: 'org-1' } });

    const result = await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: 'Hello world',
    });

    expect(insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        channel_id: 'channel-1',
        sender_profile_id: 'profile-1',
        type: 'text',
      }),
    );
    expect(insertMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'message-1',
        org_id: 'org-1',
        payload: { text: 'Hello world' },
      }),
    );
    expect(result).toEqual({ ids: { id: 'message-1', orgId: 'org-1' } });
  });

  it('creates a thread for a reply when needed', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } = await import(
      '@iconicedu/web/lib/supabase/server'
    );
    (createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      supabase,
    );

    const parentSelectChain: any = {};
    parentSelectChain.eq = vi.fn(() => parentSelectChain);
    parentSelectChain.maybeSingle = vi.fn(async () => ({
      data: {
        id: 'parent-1',
        org_id: 'org-1',
        channel_id: 'channel-1',
        sender_profile_id: 'profile-parent',
        thread_id: null,
        type: 'text',
      },
    }));

    const messageInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-2',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-1',
            type: 'text',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const messageUpdate = vi.fn().mockResolvedValue({ error: null });

    const messageTextSelectChain: any = {};
    messageTextSelectChain.eq = vi.fn(() => messageTextSelectChain);
    messageTextSelectChain.maybeSingle = vi.fn(async () => ({
      data: { payload: { text: 'Parent snippet' } },
    }));

    const messageTextInsert = vi.fn().mockResolvedValue({ error: null });

    const threadInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: 'thread-1' }, error: null }),
      }),
    });

    const participantUpsert = vi.fn().mockResolvedValue({ error: null });
    const channelMembersSelectChain: any = {};
    channelMembersSelectChain.eq = vi.fn(() => channelMembersSelectChain);
    channelMembersSelectChain.is = vi.fn(async () => ({
      data: [{ profile_id: 'profile-parent' }, { profile_id: 'profile-2' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          select: () => parentSelectChain,
          insert: messageInsert,
          update: () => ({ eq: messageUpdate }),
        };
      }
      if (table === 'message_text') {
        return {
          select: () => messageTextSelectChain,
          insert: messageTextInsert,
        };
      }
      if (table === 'threads') {
        return { insert: threadInsert };
      }
      if (table === 'thread_participants') {
        return { upsert: participantUpsert };
      }
      if (table === 'channel_members') {
        return { select: () => channelMembersSelectChain };
      }
      return {};
    });

    buildUserProfileById
      .mockResolvedValueOnce({ ids: { id: 'profile-parent', orgId: 'org-1' }, profile: { displayName: 'Parent' } })
      .mockResolvedValueOnce({ ids: { id: 'profile-1', orgId: 'org-1' }, profile: { displayName: 'Sender' } });
    mapMessageRowToVM.mockReturnValueOnce({ ids: { id: 'message-2', orgId: 'org-1' } });

    const result = await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: 'Reply',
      threadParentId: 'parent-1',
    });

    expect(threadInsert).toHaveBeenCalled();
    expect(messageUpdate).toHaveBeenCalled();
    expect(participantUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ profile_id: 'profile-parent' }),
        expect.objectContaining({ profile_id: 'profile-1' }),
        expect.objectContaining({ profile_id: 'profile-2' }),
      ]),
      { onConflict: 'org_id,thread_id,profile_id' },
    );
    expect(result).toEqual({ ids: { id: 'message-2', orgId: 'org-1' } });
  });

  it('creates a new thread when threadId does not exist yet', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } = await import(
      '@iconicedu/web/lib/supabase/server'
    );
    (createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      supabase,
    );

    const parentSelectChain: any = {};
    parentSelectChain.eq = vi.fn(() => parentSelectChain);
    parentSelectChain.maybeSingle = vi.fn(async () => ({
      data: {
        id: 'parent-2',
        org_id: 'org-1',
        channel_id: 'channel-1',
        sender_profile_id: 'profile-parent',
        thread_id: null,
        type: 'text',
      },
    }));

    const threadSelectChain: any = {};
    threadSelectChain.eq = vi.fn(() => threadSelectChain);
    threadSelectChain.maybeSingle = vi.fn(async () => ({ data: null }));

    const messageInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-3',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-1',
            type: 'text',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const messageUpdate = vi.fn().mockResolvedValue({ error: null });

    const messageTextSelectChain: any = {};
    messageTextSelectChain.eq = vi.fn(() => messageTextSelectChain);
    messageTextSelectChain.maybeSingle = vi.fn(async () => ({
      data: { payload: { text: 'Parent snippet' } },
    }));
    const messageTextInsert = vi.fn().mockResolvedValue({ error: null });

    const threadInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: 'thread-2' }, error: null }),
      }),
    });
    const participantUpsert = vi.fn().mockResolvedValue({ error: null });
    const channelMembersSelectChain: any = {};
    channelMembersSelectChain.eq = vi.fn(() => channelMembersSelectChain);
    channelMembersSelectChain.is = vi.fn(async () => ({
      data: [{ profile_id: 'profile-parent' }, { profile_id: 'profile-3' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          select: () => parentSelectChain,
          insert: messageInsert,
          update: () => ({ eq: messageUpdate }),
        };
      }
      if (table === 'message_text') {
        return {
          select: () => messageTextSelectChain,
          insert: messageTextInsert,
        };
      }
      if (table === 'threads') {
        return { select: () => threadSelectChain, insert: threadInsert };
      }
      if (table === 'thread_participants') {
        return { upsert: participantUpsert };
      }
      if (table === 'channel_members') {
        return { select: () => channelMembersSelectChain };
      }
      return {};
    });

    buildUserProfileById
      .mockResolvedValueOnce({ ids: { id: 'profile-parent', orgId: 'org-1' }, profile: { displayName: 'Parent' } })
      .mockResolvedValueOnce({ ids: { id: 'profile-1', orgId: 'org-1' }, profile: { displayName: 'Sender' } });
    mapMessageRowToVM.mockReturnValueOnce({ ids: { id: 'message-3', orgId: 'org-1' } });

    const result = await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: 'Reply',
      threadParentId: 'parent-2',
      threadId: 'thread-placeholder',
    });

    expect(threadSelectChain.maybeSingle).toHaveBeenCalled();
    expect(threadInsert).toHaveBeenCalled();
    expect(participantUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ profile_id: 'profile-parent' }),
        expect.objectContaining({ profile_id: 'profile-1' }),
        expect.objectContaining({ profile_id: 'profile-3' }),
      ]),
      { onConflict: 'org_id,thread_id,profile_id' },
    );
    expect(messageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ thread_id: 'thread-2', thread_parent_id: 'parent-2' }),
    );
    expect(result).toEqual({ ids: { id: 'message-3', orgId: 'org-1' } });
  });
});

describe('toggleMessageReactionAction', () => {
  it('adds a reaction when none exists', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } = await import(
      '@iconicedu/web/lib/supabase/server'
    );
    (createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      supabase,
    );

    const makeSelectChain = (response: { data: any }) => {
      const chain: any = {};
      chain.eq = vi.fn(() => chain);
      chain.is = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => response);
      return chain;
    };

    const selectMessage = vi.fn().mockReturnValue(
      makeSelectChain({ data: { id: 'message-1', org_id: 'org-1' } }),
    );
    const selectReaction = vi.fn().mockReturnValue(makeSelectChain({ data: null }));
    const selectCount = vi.fn().mockReturnValue(makeSelectChain({ data: null }));
    const insertReaction = vi.fn().mockResolvedValue({ error: null });
    const insertCount = vi.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { select: selectMessage };
      }
      if (table === 'message_reactions') {
        return { select: selectReaction, insert: insertReaction };
      }
      if (table === 'message_reaction_counts') {
        return { select: selectCount, insert: insertCount };
      }
      return {};
    });

    const { toggleMessageReactionAction } = await import('@iconicedu/web/app/actions/messages');
    await toggleMessageReactionAction({
      orgId: 'org-1',
      messageId: 'message-1',
      emoji: '👍',
    });

    expect(insertReaction).toHaveBeenCalled();
    expect(insertCount).toHaveBeenCalled();
  });

  it('removes a reaction when it already exists', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } = await import(
      '@iconicedu/web/lib/supabase/server'
    );
    (createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      supabase,
    );

    const makeSelectChain = (response: { data: any }) => {
      const chain: any = {};
      chain.eq = vi.fn(() => chain);
      chain.is = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => response);
      return chain;
    };

    const selectMessage = vi.fn().mockReturnValue(
      makeSelectChain({ data: { id: 'message-1', org_id: 'org-1' } }),
    );
    const selectReaction = vi.fn().mockReturnValue(
      makeSelectChain({ data: { id: 'reaction-1' } }),
    );
    const selectCount = vi.fn().mockReturnValue(
      makeSelectChain({ data: { id: 'count-1', count: 1 } }),
    );
    const deleteReaction = vi.fn().mockResolvedValue({ error: null });
    const deleteCount = vi.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { select: selectMessage };
      }
      if (table === 'message_reactions') {
        return { select: selectReaction, delete: () => ({ eq: deleteReaction }) };
      }
      if (table === 'message_reaction_counts') {
        return { select: selectCount, delete: () => ({ eq: deleteCount }) };
      }
      return {};
    });

    const { toggleMessageReactionAction } = await import('@iconicedu/web/app/actions/messages');
    await toggleMessageReactionAction({
      orgId: 'org-1',
      messageId: 'message-1',
      emoji: '👍',
    });

    expect(deleteReaction).toHaveBeenCalled();
    expect(deleteCount).toHaveBeenCalled();
  });
});

describe('deleteMessageAction', () => {
  it('soft deletes using service client after ownership checks', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const serviceSupabase = {
      from: vi.fn(),
    };
    const { createSupabaseServerClient } = await import(
      '@iconicedu/web/lib/supabase/server'
    );
    const { createSupabaseServiceClient } = await import(
      '@iconicedu/web/lib/supabase/service'
    );
    (createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      supabase,
    );
    (createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue(
      serviceSupabase,
    );

    const selectChain: any = {};
    selectChain.eq = vi.fn(() => selectChain);
    selectChain.maybeSingle = vi.fn(async () => ({
      data: { id: 'message-1', org_id: 'org-1', sender_profile_id: 'profile-1' },
    }));

    const deleteUpdateChain: any = {};
    deleteUpdateChain.eq = vi.fn(() => deleteUpdateChain);
    deleteUpdateChain.is = vi.fn(async () => ({ error: null }));
    const updateMessage = vi.fn(() => deleteUpdateChain);

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { select: () => selectChain };
      }
      return {};
    });
    serviceSupabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { update: updateMessage };
      }
      return {};
    });

    await deleteMessageAction({ orgId: 'org-1', messageId: 'message-1' });

    expect(updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        deleted_by: 'profile-1',
      }),
    );
    expect(deleteUpdateChain.eq).toHaveBeenCalledWith('id', 'message-1');
    expect(deleteUpdateChain.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(deleteUpdateChain.eq).toHaveBeenCalledWith('sender_profile_id', 'profile-1');
    expect(deleteUpdateChain.is).toHaveBeenCalledWith('deleted_at', null);
  });
});
