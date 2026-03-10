/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteMessageAction,
  sendFileMessageAction,
  sendFilesMessageAction,
  sendTextMessageAction,
  toggleHiddenMessageAction,
  toggleSavedMessageAction,
} from '@iconicedu/web/app/actions/messages';

const mapMessageRowToVM = vi.fn();
const buildUserProfileById = vi.fn();
const publishActivityEvent = vi.fn();

function createChannelLookupChain(
  data: {
    id: string;
    kind: string;
    topic?: string | null;
    primary_entity_kind?: string | null;
    primary_entity_id?: string | null;
  } | null,
) {
  const chain: any = {};
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data, error: null }));
  return chain;
}

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
  getAccountByAuthUserId: vi.fn(async () => ({
    data: { id: 'account-1', org_id: 'org-1' },
  })),
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
vi.mock('@iconicedu/web/lib/activity-feed/publisher/activity-publisher', () => ({
  publishActivityEvent: (...args: unknown[]) => publishActivityEvent(...args),
}));

vi.mock('@iconicedu/web/lib/messages/builders/thread.builder', () => ({
  buildThreadById: vi.fn(async () => ({ ids: { id: 'thread-1', orgId: 'org-1' } })),
}));
vi.mock('@iconicedu/web/lib/messages/link-preview', () => ({
  extractFirstUrl: vi.fn(
    (content: string) => content.match(/https?:\/\/\S+/)?.[0] ?? null,
  ),
  fetchLinkPreviewMetadata: vi.fn(async (url: string) => ({
    url,
    title: 'Preview title',
    description: 'Preview description',
    imageUrl: 'https://example.com/cover.png',
    siteName: 'Example',
    favicon: 'https://example.com/favicon.ico',
  })),
}));

describe('sendTextMessageAction', () => {
  beforeEach(async () => {
    mapMessageRowToVM.mockReset();
    buildUserProfileById.mockReset();
    publishActivityEvent.mockReset();
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue({
      from: vi.fn(),
    });
  });

  it('creates a text message and does not publish inbox activity for a normal channel post', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
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

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
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
    expect(publishActivityEvent).not.toHaveBeenCalled();
    expect(result).toEqual({ ids: { id: 'message-1', orgId: 'org-1' } });
  });

  it('treats @homework text as plain text when explicit assignment metadata is not provided', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-tag-1',
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
    const insertMessageText = vi.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_text') {
        return { insert: insertMessageText };
      }
      return { insert: vi.fn() };
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-tag-1', orgId: 'org-1' },
    });

    await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: '@homework Please review chapter 4',
    });

    expect(insertMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'text' }));
    expect(insertMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'message-tag-1',
        payload: { text: '@homework Please review chapter 4' },
      }),
    );
    expect(publishActivityEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'homework.assigned' }),
    );
  });

  it('publishes inbox activity for direct messages', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-dm-1',
            org_id: 'org-1',
            channel_id: 'channel-dm-1',
            sender_profile_id: 'profile-1',
            type: 'text',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertMessageText = vi.fn().mockResolvedValue({ error: null });
    const channelLookup = createChannelLookupChain({
      id: 'channel-dm-1',
      kind: 'dm',
      topic: 'Priya + Riley',
      primary_entity_kind: null,
      primary_entity_id: null,
    });
    const channelMembersChain: any = {};
    channelMembersChain.eq = vi.fn(() => channelMembersChain);
    channelMembersChain.is = vi.fn(() => channelMembersChain);
    channelMembersChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }],
      error: null,
    }));
    const profilesChain: any = {};
    profilesChain.eq = vi.fn(() => profilesChain);
    profilesChain.in = vi.fn(() => profilesChain);
    profilesChain.is = vi.fn(() => profilesChain);
    profilesChain.returns = vi.fn(async () => ({
      data: [{ id: 'profile-2', account_id: 'account-2' }],
      error: null,
    }));
    const readStateChain: any = {};
    readStateChain.eq = vi.fn(() => readStateChain);
    readStateChain.in = vi.fn(() => readStateChain);
    readStateChain.is = vi.fn(() => readStateChain);
    readStateChain.returns = vi.fn(async () => ({
      data: [{ account_id: 'account-2', last_read_at: '2026-03-09T09:55:00.000Z' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') {
        return { select: () => channelLookup };
      }
      if (table === 'channel_members') {
        return { select: () => channelMembersChain };
      }
      if (table === 'profiles') {
        return { select: () => profilesChain };
      }
      if (table === 'channel_read_state') {
        return { select: () => readStateChain };
      }
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_text') {
        return { insert: insertMessageText };
      }
      return { insert: vi.fn() };
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-dm-1', orgId: 'org-1' },
    });

    await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-dm-1',
      senderProfileId: 'profile-1',
      content: 'Hello in DM',
    });

    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'dm.posted',
        dedupeKey: 'dm.posted:message-dm-1',
        payload: expect.objectContaining({
          channelRouteKind: 'dm',
          channelTopic: 'Priya + Riley',
        }),
      }),
    );
  });

  it('suppresses dm.posted activity when recipient is actively reading the DM', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-dm-suppressed-1',
            org_id: 'org-1',
            channel_id: 'channel-dm-1',
            sender_profile_id: 'profile-1',
            type: 'text',
            created_at: '2026-03-09T10:02:00.000Z',
          },
          error: null,
        }),
      }),
    });
    const insertMessageText = vi.fn().mockResolvedValue({ error: null });
    const channelLookup = createChannelLookupChain({
      id: 'channel-dm-1',
      kind: 'dm',
      topic: 'Priya + Riley',
      primary_entity_kind: null,
      primary_entity_id: null,
    });
    const channelMembersChain: any = {};
    channelMembersChain.eq = vi.fn(() => channelMembersChain);
    channelMembersChain.is = vi.fn(() => channelMembersChain);
    channelMembersChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }],
      error: null,
    }));
    const profilesChain: any = {};
    profilesChain.eq = vi.fn(() => profilesChain);
    profilesChain.in = vi.fn(() => profilesChain);
    profilesChain.is = vi.fn(() => profilesChain);
    profilesChain.returns = vi.fn(async () => ({
      data: [{ id: 'profile-2', account_id: 'account-2' }],
      error: null,
    }));
    const readStateChain: any = {};
    readStateChain.eq = vi.fn(() => readStateChain);
    readStateChain.in = vi.fn(() => readStateChain);
    readStateChain.is = vi.fn(() => readStateChain);
    readStateChain.returns = vi.fn(async () => ({
      data: [{ account_id: 'account-2', last_read_at: '2099-01-01T00:00:00.000Z' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') return { select: () => channelLookup };
      if (table === 'channel_members') return { select: () => channelMembersChain };
      if (table === 'profiles') return { select: () => profilesChain };
      if (table === 'channel_read_state') return { select: () => readStateChain };
      if (table === 'messages') return { insert: insertMessage };
      if (table === 'message_text') return { insert: insertMessageText };
      return { insert: vi.fn() };
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-dm-suppressed-1', orgId: 'org-1' },
    });

    await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-dm-1',
      senderProfileId: 'profile-1',
      content: 'Hello in DM',
    });

    expect(publishActivityEvent).not.toHaveBeenCalled();
  });

  it('emits dm.posted for inactive recipients only in group DM', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-group-dm-1',
            org_id: 'org-1',
            channel_id: 'channel-group-dm-1',
            sender_profile_id: 'profile-1',
            type: 'text',
            created_at: '2026-03-09T10:02:00.000Z',
          },
          error: null,
        }),
      }),
    });
    const insertMessageText = vi.fn().mockResolvedValue({ error: null });
    const channelLookup = createChannelLookupChain({
      id: 'channel-group-dm-1',
      kind: 'group_dm',
      topic: 'Priya + Riley + Alex',
      primary_entity_kind: null,
      primary_entity_id: null,
    });
    const channelMembersChain: any = {};
    channelMembersChain.eq = vi.fn(() => channelMembersChain);
    channelMembersChain.is = vi.fn(() => channelMembersChain);
    channelMembersChain.returns = vi.fn(async () => ({
      data: [
        { profile_id: 'profile-1' },
        { profile_id: 'profile-2' },
        { profile_id: 'profile-3' },
      ],
      error: null,
    }));
    const profilesChain: any = {};
    profilesChain.eq = vi.fn(() => profilesChain);
    profilesChain.in = vi.fn(() => profilesChain);
    profilesChain.is = vi.fn(() => profilesChain);
    profilesChain.returns = vi.fn(async () => ({
      data: [
        { id: 'profile-2', account_id: 'account-2' },
        { id: 'profile-3', account_id: 'account-3' },
      ],
      error: null,
    }));
    const readStateChain: any = {};
    readStateChain.eq = vi.fn(() => readStateChain);
    readStateChain.in = vi.fn(() => readStateChain);
    readStateChain.is = vi.fn(() => readStateChain);
    readStateChain.returns = vi.fn(async () => ({
      data: [
        { account_id: 'account-2', last_read_at: '2099-01-01T00:00:00.000Z' },
        { account_id: 'account-3', last_read_at: '2026-03-09T09:58:00.000Z' },
      ],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') return { select: () => channelLookup };
      if (table === 'channel_members') return { select: () => channelMembersChain };
      if (table === 'profiles') return { select: () => profilesChain };
      if (table === 'channel_read_state') return { select: () => readStateChain };
      if (table === 'messages') return { insert: insertMessage };
      if (table === 'message_text') return { insert: insertMessageText };
      return { insert: vi.fn() };
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-group-dm-1', orgId: 'org-1' },
    });

    await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-group-dm-1',
      senderProfileId: 'profile-1',
      content: 'Hello group DM',
    });

    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'dm.posted',
        audienceRules: [{ kind: 'users_only', userIds: ['profile-3'] }],
      }),
    );
  });

  it('stores explicit assignment metadata as lesson assignments and emits homework activity for class channels', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-homework-1',
            org_id: 'org-1',
            channel_id: 'channel-class-1',
            sender_profile_id: 'profile-1',
            type: 'lesson-assignment',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertLessonAssignment = vi.fn().mockResolvedValue({ error: null });
    const channelLookup = createChannelLookupChain({
      id: 'channel-class-1',
      kind: 'channel',
      topic: 'Math Foundations',
      primary_entity_kind: 'learning_space',
      primary_entity_id: 'space-1',
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') {
        return { select: () => channelLookup };
      }
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_lesson_assignment') {
        return { insert: insertLessonAssignment };
      }
      return { insert: vi.fn() };
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-homework-1', orgId: 'org-1' },
    });

    await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-class-1',
      senderProfileId: 'profile-1',
      content: 'Please complete before Thursday.',
      homework: {
        kind: 'homework',
        title: 'Fractions Practice Set',
        description: 'Focus on equivalent fractions and number lines.',
        dueAt: '2026-03-13T12:00:00.000Z',
      },
    });

    expect(insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lesson-assignment',
      }),
    );
    expect(insertLessonAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'message-homework-1',
        org_id: 'org-1',
        payload: expect.objectContaining({
          title: 'Fractions Practice Set',
          description: 'Focus on equivalent fractions and number lines.',
          dueAt: '2026-03-13T12:00:00.000Z',
          kind: 'homework',
          subject: 'Math Foundations',
        }),
      }),
    );
    expect(insertLessonAssignment.mock.calls[0]?.[0]?.payload).toMatchObject({
      text: 'Please complete before Thursday.',
    });
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'homework.assigned',
        dedupeKey: 'homework.assigned:message-homework-1',
        payload: expect.objectContaining({
          messageId: 'message-homework-1',
          title: 'Fractions Practice Set',
          learningSpaceId: 'space-1',
          channelRouteKind: 'space',
        }),
      }),
    );
  });

  it('supports explicit lesson assignment metadata from the composer prompt', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-homework-2',
            org_id: 'org-1',
            channel_id: 'channel-class-1',
            sender_profile_id: 'profile-1',
            type: 'lesson-assignment',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertLessonAssignment = vi.fn().mockResolvedValue({ error: null });
    const channelLookup = createChannelLookupChain({
      id: 'channel-class-1',
      kind: 'channel',
      topic: 'Math Foundations',
      primary_entity_kind: 'learning_space',
      primary_entity_id: 'space-1',
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') {
        return { select: () => channelLookup };
      }
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_lesson_assignment') {
        return { insert: insertLessonAssignment };
      }
      return { insert: vi.fn() };
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-homework-2', orgId: 'org-1' },
    });

    await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-class-1',
      senderProfileId: 'profile-1',
      content: 'Please complete this before Friday.',
      homework: {
        kind: 'lesson',
        title: 'Fractions Practice Set',
        description: 'Focus on equivalent fractions and number lines.',
        dueAt: '2026-03-11T12:00:00.000Z',
        subject: 'Math',
      },
    });

    expect(insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lesson-assignment',
      }),
    );
    expect(insertLessonAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: 'lesson',
          title: 'Fractions Practice Set',
          description: 'Focus on equivalent fractions and number lines.',
          dueAt: '2026-03-11T12:00:00.000Z',
          subject: 'Math',
        }),
      }),
    );
  });

  it('stores pasted links as link-preview messages', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-link-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-1',
            type: 'link-preview',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertLinkPreview = vi.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_link_preview') {
        return { insert: insertLinkPreview };
      }
      return { insert: vi.fn() };
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-link-1', orgId: 'org-1' },
    });

    const result = await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: 'Check this out https://example.com/post',
    });

    expect(insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'link-preview' }),
    );
    expect(insertLinkPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'message-link-1',
        payload: expect.objectContaining({
          text: 'Check this out https://example.com/post',
          url: 'https://example.com/post',
          title: 'Preview title',
        }),
      }),
    );
    expect(result).toEqual({ ids: { id: 'message-link-1', orgId: 'org-1' } });
  });

  it('uploads a class file, creates a file message, and records it in channel files', async () => {
    const supabase = {
      from: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: 'https://signed.example.com/channel-files/brief.pdf' },
            error: null,
          })),
        })),
      },
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue({
      from: vi.fn(),
    });

    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'file-message-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-1',
            type: 'file',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertMessageFile = vi.fn(async () => ({ error: null }));
    const insertChannelFile = vi.fn(async () => ({ error: null }));
    const channelLookup = createChannelLookupChain({
      id: 'channel-1',
      kind: 'channel',
      topic: 'Algebra I',
      primary_entity_kind: 'learning_space',
      primary_entity_id: 'space-1',
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') {
        return { select: () => channelLookup };
      }
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_file') {
        return { insert: insertMessageFile };
      }
      if (table === 'channel_files') {
        return { insert: insertChannelFile };
      }
      return {};
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'file-message-1', orgId: 'org-1' },
    });

    const result = await sendFileMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      name: 'brief.pdf',
      storagePath: 'org-1/channel-1/files/profile-1/brief.pdf',
      size: 11,
      mimeType: 'application/pdf',
      content: 'See attached',
    });

    expect(supabase.storage.from).toHaveBeenCalledWith('channel-files');
    expect(insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        channel_id: 'channel-1',
        sender_profile_id: 'profile-1',
        type: 'file',
      }),
    );
    expect(insertMessageFile).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'file-message-1',
        payload: expect.objectContaining({
          url: 'org-1/channel-1/files/profile-1/brief.pdf',
          storagePath: 'org-1/channel-1/files/profile-1/brief.pdf',
          name: 'brief.pdf',
          mimeType: 'application/pdf',
          text: 'See attached',
        }),
      }),
    );
    expect(insertChannelFile).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'file-message-1',
        kind: 'file',
        url: 'org-1/channel-1/files/profile-1/brief.pdf',
        name: 'brief.pdf',
      }),
    );
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'file.uploaded',
        dedupeKey: 'file.uploaded:file-message-1',
        payload: expect.objectContaining({
          messageId: 'file-message-1',
          name: 'brief.pdf',
          storagePath: 'org-1/channel-1/files/profile-1/brief.pdf',
          channelRouteKind: 'space',
          learningSpaceId: 'space-1',
        }),
      }),
    );
    expect(result).toEqual({ ids: { id: 'file-message-1', orgId: 'org-1' } });
  });

  it('stores image uploads as image messages and records them in channel media', async () => {
    const supabase = {
      from: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: 'https://signed.example.com/channel-files/photo.png' },
            error: null,
          })),
        })),
      },
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue({
      from: vi.fn(),
    });

    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'image-message-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-1',
            type: 'image',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertMessageImage = vi.fn(async () => ({ error: null }));
    const insertChannelMedia = vi.fn(async () => ({ error: null }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_image') {
        return { insert: insertMessageImage };
      }
      if (table === 'channel_media') {
        return { insert: insertChannelMedia };
      }
      return {};
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'image-message-1', orgId: 'org-1' },
    });

    const result = await sendFileMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      name: 'photo.png',
      storagePath: 'org-1/channel-1/images/profile-1/photo.png',
      thumbnailUrl: 'https://public.example.com/thumbs/photo.jpg',
      size: 99,
      mimeType: 'image/png',
      content: 'Look at this',
    });

    expect(insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'image',
      }),
    );
    expect(insertMessageImage).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'image-message-1',
        payload: expect.objectContaining({
          url: 'org-1/channel-1/images/profile-1/photo.png',
          storagePath: 'org-1/channel-1/images/profile-1/photo.png',
          thumbnailUrl: 'https://public.example.com/thumbs/photo.jpg',
          name: 'photo.png',
          mimeType: 'image/png',
          text: 'Look at this',
        }),
      }),
    );
    expect(insertChannelMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'image-message-1',
        type: 'image',
        url: 'org-1/channel-1/images/profile-1/photo.png',
        name: 'photo.png',
      }),
    );
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'file.uploaded',
        dedupeKey: 'file.uploaded:image-message-1',
        payload: expect.objectContaining({
          messageId: 'image-message-1',
          name: 'photo.png',
          mimeType: 'image/png',
        }),
      }),
    );
    expect(result).toEqual({ ids: { id: 'image-message-1', orgId: 'org-1' } });
  });

  it('stores audio uploads as audio-recording messages', async () => {
    const supabase = {
      from: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: 'https://signed.example.com/channel-files/voice.webm' },
            error: null,
          })),
        })),
      },
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue({
      from: vi.fn(),
    });

    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'audio-message-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-1',
            type: 'audio-recording',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertAudioRecording = vi.fn(async () => ({ error: null }));
    const insertChannelFile = vi.fn(async () => ({ error: null }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_audio_recording') {
        return { insert: insertAudioRecording };
      }
      if (table === 'channel_files') {
        return { insert: insertChannelFile };
      }
      return {};
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'audio-message-1', orgId: 'org-1' },
    });

    const result = await sendFileMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      name: 'voice-message.webm',
      storagePath: 'org-1/channel-1/audio/profile-1/voice-message.webm',
      size: 55,
      mimeType: 'audio/webm',
      durationSeconds: 9,
      content: 'Voice note',
    });

    expect(insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'audio-recording',
      }),
    );
    expect(insertAudioRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'audio-message-1',
        payload: expect.objectContaining({
          url: 'org-1/channel-1/audio/profile-1/voice-message.webm',
          storagePath: 'org-1/channel-1/audio/profile-1/voice-message.webm',
          durationSeconds: 9,
          fileSize: 55,
          mimeType: 'audio/webm',
          text: 'Voice note',
        }),
      }),
    );
    expect(insertChannelFile).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'audio-message-1',
        kind: 'file',
        url: 'org-1/channel-1/audio/profile-1/voice-message.webm',
        name: 'voice-message.webm',
        mime_type: 'audio/webm',
        size: 55,
      }),
    );
    expect(publishActivityEvent).not.toHaveBeenCalled();
    expect(result).toEqual({ ids: { id: 'audio-message-1', orgId: 'org-1' } });
  });

  it('emits dm.posted for direct-message file uploads', async () => {
    const supabase = {
      from: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: 'https://signed.example.com/channel-files/brief.pdf' },
            error: null,
          })),
        })),
      },
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue({
      from: vi.fn(),
    });

    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'file-message-dm-1',
            org_id: 'org-1',
            channel_id: 'channel-dm-1',
            sender_profile_id: 'profile-1',
            type: 'file',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertMessageFile = vi.fn(async () => ({ error: null }));
    const insertChannelFile = vi.fn(async () => ({ error: null }));
    const channelLookup = createChannelLookupChain({
      id: 'channel-dm-1',
      kind: 'dm',
      topic: 'Priya + Riley',
      primary_entity_kind: null,
      primary_entity_id: null,
    });
    const channelMembersChain: any = {};
    channelMembersChain.eq = vi.fn(() => channelMembersChain);
    channelMembersChain.is = vi.fn(() => channelMembersChain);
    channelMembersChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }],
      error: null,
    }));
    const profilesChain: any = {};
    profilesChain.eq = vi.fn(() => profilesChain);
    profilesChain.in = vi.fn(() => profilesChain);
    profilesChain.is = vi.fn(() => profilesChain);
    profilesChain.returns = vi.fn(async () => ({
      data: [{ id: 'profile-2', account_id: 'account-2' }],
      error: null,
    }));
    const readStateChain: any = {};
    readStateChain.eq = vi.fn(() => readStateChain);
    readStateChain.in = vi.fn(() => readStateChain);
    readStateChain.is = vi.fn(() => readStateChain);
    readStateChain.returns = vi.fn(async () => ({
      data: [{ account_id: 'account-2', last_read_at: '2026-03-09T09:55:00.000Z' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') return { select: () => channelLookup };
      if (table === 'channel_members') return { select: () => channelMembersChain };
      if (table === 'profiles') return { select: () => profilesChain };
      if (table === 'channel_read_state') return { select: () => readStateChain };
      if (table === 'messages') return { insert: insertMessage };
      if (table === 'message_file') return { insert: insertMessageFile };
      if (table === 'channel_files') return { insert: insertChannelFile };
      return {};
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'file-message-dm-1', orgId: 'org-1' },
    });

    await sendFileMessageAction({
      orgId: 'org-1',
      channelId: 'channel-dm-1',
      senderProfileId: 'profile-1',
      name: 'brief.pdf',
      storagePath: 'org-1/channel-dm-1/files/profile-1/brief.pdf',
      size: 11,
      mimeType: 'application/pdf',
      content: 'See attached',
    });

    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'dm.posted',
        dedupeKey: 'dm.posted:file-message-dm-1',
        payload: expect.objectContaining({
          channelRouteKind: 'dm',
          dmMessageKind: 'file',
          senderName: 'Priya',
        }),
      }),
    );
  });

  it('emits dm.posted for direct-message audio uploads', async () => {
    const supabase = {
      from: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: 'https://signed.example.com/channel-files/voice.webm' },
            error: null,
          })),
        })),
      },
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue({
      from: vi.fn(),
    });

    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'audio-message-dm-1',
            org_id: 'org-1',
            channel_id: 'channel-dm-1',
            sender_profile_id: 'profile-1',
            type: 'audio-recording',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertAudioRecording = vi.fn(async () => ({ error: null }));
    const insertChannelFile = vi.fn(async () => ({ error: null }));
    const channelLookup = createChannelLookupChain({
      id: 'channel-dm-1',
      kind: 'dm',
      topic: 'Priya + Riley',
      primary_entity_kind: null,
      primary_entity_id: null,
    });
    const channelMembersChain: any = {};
    channelMembersChain.eq = vi.fn(() => channelMembersChain);
    channelMembersChain.is = vi.fn(() => channelMembersChain);
    channelMembersChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }],
      error: null,
    }));
    const profilesChain: any = {};
    profilesChain.eq = vi.fn(() => profilesChain);
    profilesChain.in = vi.fn(() => profilesChain);
    profilesChain.is = vi.fn(() => profilesChain);
    profilesChain.returns = vi.fn(async () => ({
      data: [{ id: 'profile-2', account_id: 'account-2' }],
      error: null,
    }));
    const readStateChain: any = {};
    readStateChain.eq = vi.fn(() => readStateChain);
    readStateChain.in = vi.fn(() => readStateChain);
    readStateChain.is = vi.fn(() => readStateChain);
    readStateChain.returns = vi.fn(async () => ({
      data: [{ account_id: 'account-2', last_read_at: '2026-03-09T09:55:00.000Z' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') return { select: () => channelLookup };
      if (table === 'channel_members') return { select: () => channelMembersChain };
      if (table === 'profiles') return { select: () => profilesChain };
      if (table === 'channel_read_state') return { select: () => readStateChain };
      if (table === 'messages') return { insert: insertMessage };
      if (table === 'message_audio_recording') return { insert: insertAudioRecording };
      if (table === 'channel_files') return { insert: insertChannelFile };
      return {};
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'audio-message-dm-1', orgId: 'org-1' },
    });

    await sendFileMessageAction({
      orgId: 'org-1',
      channelId: 'channel-dm-1',
      senderProfileId: 'profile-1',
      name: 'voice-message.webm',
      storagePath: 'org-1/channel-dm-1/audio/profile-1/voice-message.webm',
      size: 55,
      mimeType: 'audio/webm',
      durationSeconds: 9,
      content: 'Voice note',
    });

    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'dm.posted',
        dedupeKey: 'dm.posted:audio-message-dm-1',
        payload: expect.objectContaining({
          channelRouteKind: 'dm',
          dmMessageKind: 'audio',
          senderName: 'Priya',
        }),
      }),
    );
  });

  it('stores grouped file uploads as one file message with multiple attachments', async () => {
    const supabase = {
      from: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async (path: string) => ({
            data: { signedUrl: `https://signed.example.com/${path}` },
            error: null,
          })),
        })),
      },
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue({
      from: vi.fn(),
      storage: { from: vi.fn(() => ({ remove: vi.fn(async () => ({ error: null })) })) },
    });

    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'file-message-group-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-1',
            type: 'file',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertMessageFile = vi.fn(async () => ({ error: null }));
    const insertChannelFiles = vi.fn(async () => ({ error: null }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') return { insert: insertMessage };
      if (table === 'message_file') return { insert: insertMessageFile };
      if (table === 'channel_files') return { insert: insertChannelFiles };
      return {};
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'file-message-group-1', orgId: 'org-1' },
    });

    const result = await sendFilesMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: 'Three docs',
      assets: [
        {
          name: 'brief.pdf',
          storagePath: 'org-1/channel-1/files/profile-1/brief.pdf',
          size: 11,
          mimeType: 'application/pdf',
        },
        {
          name: 'notes.docx',
          storagePath: 'org-1/channel-1/files/profile-1/notes.docx',
          size: 12,
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        {
          name: 'table.csv',
          storagePath: 'org-1/channel-1/files/profile-1/table.csv',
          size: 13,
          mimeType: 'text/csv',
        },
      ],
    });

    expect(insertMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'file' }));
    expect(insertMessageFile).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'file-message-group-1',
        payload: expect.objectContaining({
          name: 'brief.pdf',
          text: 'Three docs',
          attachments: expect.arrayContaining([
            expect.objectContaining({ name: 'brief.pdf' }),
            expect.objectContaining({ name: 'notes.docx' }),
            expect.objectContaining({ name: 'table.csv' }),
          ]),
        }),
      }),
    );
    expect(insertChannelFiles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          message_id: 'file-message-group-1',
          name: 'brief.pdf',
        }),
        expect.objectContaining({
          message_id: 'file-message-group-1',
          name: 'notes.docx',
        }),
        expect.objectContaining({
          message_id: 'file-message-group-1',
          name: 'table.csv',
        }),
      ]),
    );
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'file.uploaded',
        dedupeKey: 'file.uploaded:file-message-group-1',
        payload: expect.objectContaining({
          messageId: 'file-message-group-1',
          fileCount: 3,
        }),
      }),
    );
    expect(result).toEqual({ ids: { id: 'file-message-group-1', orgId: 'org-1' } });
  });

  it('stores grouped image uploads as one image message with multiple attachments', async () => {
    const supabase = {
      from: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async (path: string) => ({
            data: { signedUrl: `https://signed.example.com/${path}` },
            error: null,
          })),
        })),
      },
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue({
      from: vi.fn(),
      storage: { from: vi.fn(() => ({ remove: vi.fn(async () => ({ error: null })) })) },
    });

    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'image-message-group-1',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-1',
            type: 'image',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const insertMessageImage = vi.fn(async () => ({ error: null }));
    const insertChannelMedia = vi.fn(async () => ({ error: null }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') return { insert: insertMessage };
      if (table === 'message_image') return { insert: insertMessageImage };
      if (table === 'channel_media') return { insert: insertChannelMedia };
      return {};
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'image-message-group-1', orgId: 'org-1' },
    });

    const result = await sendFilesMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      assets: [
        {
          name: 'photo-1.png',
          storagePath: 'org-1/channel-1/images/profile-1/photo-1.png',
          thumbnailUrl: 'https://public.example.com/thumbs/photo-1.jpg',
          size: 21,
          mimeType: 'image/png',
        },
        {
          name: 'photo-2.png',
          storagePath: 'org-1/channel-1/images/profile-1/photo-2.png',
          thumbnailUrl: 'https://public.example.com/thumbs/photo-2.jpg',
          size: 22,
          mimeType: 'image/png',
        },
      ],
    });

    expect(insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'image' }),
    );
    expect(insertMessageImage).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: 'image-message-group-1',
        payload: expect.objectContaining({
          name: 'photo-1.png',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              name: 'photo-1.png',
              thumbnailUrl: 'https://public.example.com/thumbs/photo-1.jpg',
            }),
            expect.objectContaining({
              name: 'photo-2.png',
              thumbnailUrl: 'https://public.example.com/thumbs/photo-2.jpg',
            }),
          ]),
        }),
      }),
    );
    expect(insertChannelMedia).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          message_id: 'image-message-group-1',
          name: 'photo-1.png',
        }),
        expect.objectContaining({
          message_id: 'image-message-group-1',
          name: 'photo-2.png',
        }),
      ]),
    );
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'file.uploaded',
        dedupeKey: 'file.uploaded:image-message-group-1',
        payload: expect.objectContaining({
          messageId: 'image-message-group-1',
          fileCount: 2,
          mimeType: 'image/*',
        }),
      }),
    );
    expect(result).toEqual({ ids: { id: 'image-message-group-1', orgId: 'org-1' } });
  });

  it('stores mentions in payload and creates mention notifications for opted-in recipients', async () => {
    const supabase = {
      from: vi.fn(),
    };
    const serviceSupabase = {
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(serviceSupabase);

    const insertMessage = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-mention-1',
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
    const insertMessageText = vi.fn().mockResolvedValue({ error: null });
    const channelMembersSelectChain: any = {};
    channelMembersSelectChain.eq = vi.fn(() => channelMembersSelectChain);
    channelMembersSelectChain.is = vi.fn(() => channelMembersSelectChain);
    channelMembersSelectChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-2' }, { profile_id: 'profile-3' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channel_members') {
        return { select: () => channelMembersSelectChain };
      }
      if (table === 'messages') {
        return { insert: insertMessage };
      }
      if (table === 'message_text') {
        return { insert: insertMessageText };
      }
      return {};
    });

    const notificationPreferencesChain: any = {};
    notificationPreferencesChain.select = vi.fn(() => notificationPreferencesChain);
    notificationPreferencesChain.eq = vi.fn(() => notificationPreferencesChain);
    notificationPreferencesChain.in = vi.fn(() => notificationPreferencesChain);
    notificationPreferencesChain.is = vi.fn(() => notificationPreferencesChain);
    notificationPreferencesChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-2', channels: ['push'], muted: false }],
      error: null,
    }));
    serviceSupabase.from.mockImplementation((table: string) => {
      if (table === 'notification_preferences') {
        return notificationPreferencesChain;
      }
      return {};
    });

    publishActivityEvent.mockResolvedValue({});

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Sender Name' },
    });
    mapMessageRowToVM.mockReturnValueOnce({
      ids: { id: 'message-mention-1', orgId: 'org-1' },
    });

    await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: 'Hello @Taylor Reed',
      mentions: [
        { profileId: 'profile-2', displayName: 'Taylor Reed', start: 6, end: 18 },
        { profileId: 'profile-1', displayName: 'Sender Name', start: 0, end: 12 },
      ],
    });

    expect(insertMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          text: 'Hello @Taylor Reed',
          mentions: [
            { profileId: 'profile-2', displayName: 'Taylor Reed', start: 6, end: 18 },
          ],
        },
      }),
    );
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        eventType: 'message.posted',
        actorProfileId: 'profile-1',
        dedupeKey: 'message.mention:message-mention-1:profile-2',
        payload: expect.objectContaining({
          mentionedProfileId: 'profile-2',
          senderName: 'Sender Name',
        }),
      }),
    );
    expect(publishActivityEvent).toHaveBeenCalledTimes(1);
  });

  it('creates a thread for a reply when needed', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

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
    const participantSelectChain: any = {};
    participantSelectChain.eq = vi.fn(() => participantSelectChain);
    participantSelectChain.is = vi.fn(() => participantSelectChain);
    participantSelectChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-parent' }, { profile_id: 'profile-1' }],
      error: null,
    }));
    const channelLookup = createChannelLookupChain({
      id: 'channel-1',
      kind: 'channel',
      topic: 'General',
      primary_entity_kind: null,
      primary_entity_id: null,
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') {
        return { select: () => channelLookup };
      }
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
        return { upsert: participantUpsert, select: () => participantSelectChain };
      }
      return {};
    });

    buildUserProfileById
      .mockResolvedValueOnce({
        ids: { id: 'profile-parent', orgId: 'org-1' },
        profile: { displayName: 'Parent' },
      })
      .mockResolvedValueOnce({
        ids: { id: 'profile-1', orgId: 'org-1' },
        profile: { displayName: 'Sender' },
      });
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
      ]),
      { onConflict: 'org_id,thread_id,profile_id' },
    );
    const createdThreadParticipants = participantUpsert.mock.calls[0]?.[0] ?? [];
    expect(createdThreadParticipants).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ profile_id: 'profile-2' })]),
    );
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'message.thread-reply:message-2:profile-parent',
        scope: { kind: 'user', userId: 'profile-parent' },
        payload: expect.objectContaining({ threadReply: true }),
      }),
    );
    expect(result).toEqual({ ids: { id: 'message-2', orgId: 'org-1' } });
  });

  it('creates a new thread when threadId does not exist yet', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

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
    const participantSelectChain: any = {};
    participantSelectChain.eq = vi.fn(() => participantSelectChain);
    participantSelectChain.is = vi.fn(() => participantSelectChain);
    participantSelectChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-parent' }, { profile_id: 'profile-1' }],
      error: null,
    }));
    const channelLookup = createChannelLookupChain({
      id: 'channel-1',
      kind: 'channel',
      topic: 'General',
      primary_entity_kind: null,
      primary_entity_id: null,
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') {
        return { select: () => channelLookup };
      }
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
        return { upsert: participantUpsert, select: () => participantSelectChain };
      }
      return {};
    });

    buildUserProfileById
      .mockResolvedValueOnce({
        ids: { id: 'profile-parent', orgId: 'org-1' },
        profile: { displayName: 'Parent' },
      })
      .mockResolvedValueOnce({
        ids: { id: 'profile-1', orgId: 'org-1' },
        profile: { displayName: 'Sender' },
      });
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
      ]),
      { onConflict: 'org_id,thread_id,profile_id' },
    );
    const placeholderThreadParticipants = participantUpsert.mock.calls[0]?.[0] ?? [];
    expect(placeholderThreadParticipants).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ profile_id: 'profile-3' })]),
    );
    expect(messageInsert).toHaveBeenCalledWith(
      expect.objectContaining({ thread_id: 'thread-2', thread_parent_id: 'parent-2' }),
    );
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'message.thread-reply:message-3:profile-parent',
        scope: { kind: 'user', userId: 'profile-parent' },
      }),
    );
    expect(result).toEqual({ ids: { id: 'message-3', orgId: 'org-1' } });
  });

  it('upserts the parent author and current replier when replying to an existing thread', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

    const parentSelectChain: any = {};
    parentSelectChain.eq = vi.fn(() => parentSelectChain);
    parentSelectChain.maybeSingle = vi.fn(async () => ({
      data: {
        id: 'parent-3',
        org_id: 'org-1',
        channel_id: 'channel-1',
        sender_profile_id: 'profile-parent',
        thread_id: 'thread-existing',
        type: 'text',
      },
    }));

    const messageInsert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: 'message-4',
            org_id: 'org-1',
            channel_id: 'channel-1',
            sender_profile_id: 'profile-2',
            type: 'text',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });
    const messageTextInsert = vi.fn().mockResolvedValue({ error: null });
    const threadSelectChain: any = {};
    threadSelectChain.eq = vi.fn(() => threadSelectChain);
    threadSelectChain.maybeSingle = vi.fn(async () => ({
      data: { id: 'thread-existing', message_count: 2 },
    }));
    const updateThread = vi.fn().mockResolvedValue({ error: null });
    const participantUpsert = vi.fn().mockResolvedValue({ error: null });
    const participantSelectChain: any = {};
    participantSelectChain.eq = vi.fn(() => participantSelectChain);
    participantSelectChain.is = vi.fn(() => participantSelectChain);
    participantSelectChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-parent' }, { profile_id: 'profile-1' }],
      error: null,
    }));
    const channelLookup = createChannelLookupChain({
      id: 'channel-1',
      kind: 'channel',
      topic: 'General',
      primary_entity_kind: null,
      primary_entity_id: null,
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'channels') {
        return { select: () => channelLookup };
      }
      if (table === 'messages') {
        return {
          select: () => parentSelectChain,
          insert: messageInsert,
        };
      }
      if (table === 'message_text') {
        return {
          insert: messageTextInsert,
        };
      }
      if (table === 'thread_participants') {
        return { upsert: participantUpsert, select: () => participantSelectChain };
      }
      if (table === 'threads') {
        return {
          select: () => threadSelectChain,
          update: () => ({ eq: updateThread }),
        };
      }
      return {};
    });

    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-2', orgId: 'org-1' },
      profile: { displayName: 'Replier' },
    });
    mapMessageRowToVM.mockReturnValueOnce({ ids: { id: 'message-4', orgId: 'org-1' } });

    const result = await sendTextMessageAction({
      orgId: 'org-1',
      channelId: 'channel-1',
      senderProfileId: 'profile-1',
      content: 'Another reply',
      threadParentId: 'parent-3',
      threadId: 'thread-existing',
    });

    expect(participantUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ profile_id: 'profile-parent' }),
        expect.objectContaining({ profile_id: 'profile-1' }),
      ]),
      { onConflict: 'org_id,thread_id,profile_id' },
    );
    expect(updateThread).toHaveBeenCalled();
    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'message.thread-reply:message-4:profile-parent',
        scope: { kind: 'user', userId: 'profile-parent' },
      }),
    );
    expect(result).toEqual({ ids: { id: 'message-4', orgId: 'org-1' } });
  });
});

describe('toggleMessageReactionAction', () => {
  it('adds a reaction when none exists', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

    const makeSelectChain = (response: { data: any }) => {
      const chain: any = {};
      chain.eq = vi.fn(() => chain);
      chain.is = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => response);
      return chain;
    };

    const selectMessage = vi
      .fn()
      .mockReturnValue(makeSelectChain({ data: { id: 'message-1', org_id: 'org-1' } }));
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

    const { toggleMessageReactionAction } =
      await import('@iconicedu/web/app/actions/messages');
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
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

    const makeSelectChain = (response: { data: any }) => {
      const chain: any = {};
      chain.eq = vi.fn(() => chain);
      chain.is = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => response);
      return chain;
    };

    const selectMessage = vi
      .fn()
      .mockReturnValue(makeSelectChain({ data: { id: 'message-1', org_id: 'org-1' } }));
    const selectReaction = vi
      .fn()
      .mockReturnValue(makeSelectChain({ data: { id: 'reaction-1' } }));
    const selectCount = vi
      .fn()
      .mockReturnValue(makeSelectChain({ data: { id: 'count-1', count: 1 } }));
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

    const { toggleMessageReactionAction } =
      await import('@iconicedu/web/app/actions/messages');
    await toggleMessageReactionAction({
      orgId: 'org-1',
      messageId: 'message-1',
      emoji: '👍',
    });

    expect(deleteReaction).toHaveBeenCalled();
    expect(deleteCount).toHaveBeenCalled();
  });

  it('publishes dm.reaction.added for direct-message reactions', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

    const makeSelectChain = (response: { data: any }) => {
      const chain: any = {};
      chain.eq = vi.fn(() => chain);
      chain.is = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => response);
      chain.returns = vi.fn(async () => response);
      return chain;
    };

    const selectMessage = vi.fn().mockReturnValue(
      makeSelectChain({
        data: { id: 'message-1', org_id: 'org-1', channel_id: 'channel-dm-1' },
      }),
    );
    const selectReaction = vi.fn().mockReturnValue(makeSelectChain({ data: null }));
    const selectCount = vi.fn().mockReturnValue(makeSelectChain({ data: null }));
    const insertReaction = vi.fn().mockResolvedValue({ error: null });
    const insertCount = vi.fn().mockResolvedValue({ error: null });
    const channelLookup = createChannelLookupChain({
      id: 'channel-dm-1',
      kind: 'dm',
      topic: 'Priya + Riley',
      primary_entity_kind: null,
      primary_entity_id: null,
    });
    const channelMembersChain: any = {};
    channelMembersChain.eq = vi.fn(() => channelMembersChain);
    channelMembersChain.is = vi.fn(() => channelMembersChain);
    channelMembersChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }],
      error: null,
    }));
    const profilesChain: any = {};
    profilesChain.eq = vi.fn(() => profilesChain);
    profilesChain.in = vi.fn(() => profilesChain);
    profilesChain.is = vi.fn(() => profilesChain);
    profilesChain.returns = vi.fn(async () => ({
      data: [{ id: 'profile-2', account_id: 'account-2' }],
      error: null,
    }));
    const readStateChain: any = {};
    readStateChain.eq = vi.fn(() => readStateChain);
    readStateChain.in = vi.fn(() => readStateChain);
    readStateChain.is = vi.fn(() => readStateChain);
    readStateChain.returns = vi.fn(async () => ({
      data: [{ account_id: 'account-2', last_read_at: '2026-03-09T09:55:00.000Z' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') return { select: selectMessage };
      if (table === 'message_reactions')
        return { select: selectReaction, insert: insertReaction };
      if (table === 'message_reaction_counts')
        return { select: selectCount, insert: insertCount };
      if (table === 'channels') return { select: () => channelLookup };
      if (table === 'channel_members') return { select: () => channelMembersChain };
      if (table === 'profiles') return { select: () => profilesChain };
      if (table === 'channel_read_state') return { select: () => readStateChain };
      return {};
    });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });

    const { toggleMessageReactionAction } =
      await import('@iconicedu/web/app/actions/messages');
    await toggleMessageReactionAction({
      orgId: 'org-1',
      messageId: 'message-1',
      emoji: '👍',
    });

    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'dm.reaction.added',
        payload: expect.objectContaining({
          messageId: 'message-1',
          channelId: 'channel-dm-1',
          senderName: 'Priya',
          emoji: '👍',
        }),
        audienceRules: [{ kind: 'users_only', userIds: ['profile-2'] }],
      }),
    );
  });

  it('publishes dm.reaction.removed for direct-message reaction removals', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

    const makeSelectChain = (response: { data: any }) => {
      const chain: any = {};
      chain.eq = vi.fn(() => chain);
      chain.is = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => response);
      chain.returns = vi.fn(async () => response);
      return chain;
    };

    const selectMessage = vi.fn().mockReturnValue(
      makeSelectChain({
        data: { id: 'message-1', org_id: 'org-1', channel_id: 'channel-dm-1' },
      }),
    );
    const selectReaction = vi
      .fn()
      .mockReturnValue(makeSelectChain({ data: { id: 'reaction-1' } }));
    const selectCount = vi
      .fn()
      .mockReturnValue(makeSelectChain({ data: { id: 'count-1', count: 1 } }));
    const deleteReaction = vi.fn().mockResolvedValue({ error: null });
    const deleteCount = vi.fn().mockResolvedValue({ error: null });
    const channelLookup = createChannelLookupChain({
      id: 'channel-dm-1',
      kind: 'dm',
      topic: 'Priya + Riley',
      primary_entity_kind: null,
      primary_entity_id: null,
    });
    const channelMembersChain: any = {};
    channelMembersChain.eq = vi.fn(() => channelMembersChain);
    channelMembersChain.is = vi.fn(() => channelMembersChain);
    channelMembersChain.returns = vi.fn(async () => ({
      data: [{ profile_id: 'profile-1' }, { profile_id: 'profile-2' }],
      error: null,
    }));
    const profilesChain: any = {};
    profilesChain.eq = vi.fn(() => profilesChain);
    profilesChain.in = vi.fn(() => profilesChain);
    profilesChain.is = vi.fn(() => profilesChain);
    profilesChain.returns = vi.fn(async () => ({
      data: [{ id: 'profile-2', account_id: 'account-2' }],
      error: null,
    }));
    const readStateChain: any = {};
    readStateChain.eq = vi.fn(() => readStateChain);
    readStateChain.in = vi.fn(() => readStateChain);
    readStateChain.is = vi.fn(() => readStateChain);
    readStateChain.returns = vi.fn(async () => ({
      data: [{ account_id: 'account-2', last_read_at: '2026-03-09T09:55:00.000Z' }],
      error: null,
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') return { select: selectMessage };
      if (table === 'message_reactions')
        return { select: selectReaction, delete: () => ({ eq: deleteReaction }) };
      if (table === 'message_reaction_counts')
        return { select: selectCount, delete: () => ({ eq: deleteCount }) };
      if (table === 'channels') return { select: () => channelLookup };
      if (table === 'channel_members') return { select: () => channelMembersChain };
      if (table === 'profiles') return { select: () => profilesChain };
      if (table === 'channel_read_state') return { select: () => readStateChain };
      return {};
    });
    buildUserProfileById.mockResolvedValueOnce({
      ids: { id: 'profile-1', orgId: 'org-1' },
      profile: { displayName: 'Priya' },
    });

    const { toggleMessageReactionAction } =
      await import('@iconicedu/web/app/actions/messages');
    await toggleMessageReactionAction({
      orgId: 'org-1',
      messageId: 'message-1',
      emoji: '👍',
    });

    expect(publishActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'dm.reaction.removed',
        payload: expect.objectContaining({
          messageId: 'message-1',
          channelId: 'channel-dm-1',
          senderName: 'Priya',
          emoji: '👍',
        }),
        audienceRules: [{ kind: 'users_only', userIds: ['profile-2'] }],
      }),
    );
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
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(serviceSupabase);

    const selectChain: any = {};
    selectChain.eq = vi.fn(() => selectChain);
    selectChain.maybeSingle = vi.fn(async () => ({
      data: { id: 'message-1', org_id: 'org-1', sender_profile_id: 'profile-1' },
    }));

    const deleteUpdateChain: any = {};
    deleteUpdateChain.eq = vi.fn(() => deleteUpdateChain);
    deleteUpdateChain.is = vi.fn(async () => ({ error: null }));
    const updateMessage = vi.fn(() => deleteUpdateChain);
    const activityEventSelectChain: any = {};
    activityEventSelectChain.eq = vi.fn(() => activityEventSelectChain);
    activityEventSelectChain.contains = vi.fn(() => activityEventSelectChain);
    activityEventSelectChain.is = vi.fn(() => activityEventSelectChain);
    activityEventSelectChain.returns = vi.fn(async () => ({ data: [], error: null }));

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
      if (table === 'activity_events') {
        return { select: () => activityEventSelectChain };
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

  it('recalls related activity events/items and updates affected groups', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const serviceSupabase = {
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { createSupabaseServiceClient } =
      await import('@iconicedu/web/lib/supabase/service');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      createSupabaseServiceClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(serviceSupabase);

    const messageSelectChain: any = {};
    messageSelectChain.eq = vi.fn(() => messageSelectChain);
    messageSelectChain.maybeSingle = vi.fn(async () => ({
      data: { id: 'message-1', org_id: 'org-1', sender_profile_id: 'profile-1' },
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { select: () => messageSelectChain };
      }
      return {};
    });

    const deleteMessageChain: any = {};
    deleteMessageChain.eq = vi.fn(() => deleteMessageChain);
    deleteMessageChain.is = vi.fn(async () => ({ error: null }));
    const updateMessage = vi.fn(() => deleteMessageChain);

    const activityEventSelectChain: any = {};
    activityEventSelectChain.eq = vi.fn(() => activityEventSelectChain);
    activityEventSelectChain.contains = vi.fn(() => activityEventSelectChain);
    activityEventSelectChain.is = vi.fn(() => activityEventSelectChain);
    activityEventSelectChain.returns = vi.fn(async () => ({
      data: [{ id: 'event-1' }, { id: 'event-2' }],
      error: null,
    }));

    const activityEventsUpdateChain: any = {};
    activityEventsUpdateChain.eq = vi.fn(() => activityEventsUpdateChain);
    activityEventsUpdateChain.in = vi.fn(() => activityEventsUpdateChain);
    activityEventsUpdateChain.is = vi.fn(async () => ({ error: null }));
    const updateActivityEvents = vi.fn(() => activityEventsUpdateChain);

    const feedItemsSelectChain: any = {};
    feedItemsSelectChain.eq = vi.fn(() => feedItemsSelectChain);
    feedItemsSelectChain.in = vi.fn(() => feedItemsSelectChain);
    feedItemsSelectChain.is = vi.fn(() => feedItemsSelectChain);
    feedItemsSelectChain.returns = vi.fn(async () => ({
      data: [{ id: 'leaf-1' }, { id: 'leaf-2' }],
      error: null,
    }));

    const feedItemsDeleteChain: any = {};
    feedItemsDeleteChain.eq = vi.fn(() => feedItemsDeleteChain);
    feedItemsDeleteChain.in = vi.fn(() => feedItemsDeleteChain);
    feedItemsDeleteChain.is = vi.fn(async () => ({ error: null }));
    const updateFeedItems = vi.fn(() => feedItemsDeleteChain);

    const feedItemsGroupUpdateChain: any = {};
    feedItemsGroupUpdateChain.eq = vi.fn(() => feedItemsGroupUpdateChain);
    feedItemsGroupUpdateChain.is = vi.fn(async () => ({ error: null }));
    const updateFeedItemsForGroup = vi.fn(() => feedItemsGroupUpdateChain);

    const groupMembersSelectChain: any = {};
    groupMembersSelectChain.eq = vi.fn(() => groupMembersSelectChain);
    groupMembersSelectChain.in = vi.fn(() => groupMembersSelectChain);
    groupMembersSelectChain.is = vi.fn(() => groupMembersSelectChain);
    groupMembersSelectChain.returns = vi.fn(async () => ({
      data: [{ group_id: 'group-1', item_id: 'leaf-1' }],
      error: null,
    }));

    const groupMembersDeleteChain: any = {};
    groupMembersDeleteChain.eq = vi.fn(() => groupMembersDeleteChain);
    groupMembersDeleteChain.in = vi.fn(() => groupMembersDeleteChain);
    groupMembersDeleteChain.is = vi.fn(async () => ({ error: null }));
    const updateGroupMembers = vi.fn(() => groupMembersDeleteChain);

    const remainingGroupMembersChain: any = {};
    remainingGroupMembersChain.eq = vi.fn(() => remainingGroupMembersChain);
    remainingGroupMembersChain.is = vi.fn(() => remainingGroupMembersChain);
    remainingGroupMembersChain.returns = vi.fn(async () => ({ data: [], error: null }));

    let activityFeedItemsSelectCalls = 0;
    let activityFeedItemsUpdateCalls = 0;
    let groupMembersSelectCalls = 0;

    serviceSupabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { update: updateMessage };
      }
      if (table === 'activity_events') {
        return { select: () => activityEventSelectChain, update: updateActivityEvents };
      }
      if (table === 'activity_feed_items') {
        return {
          select: () => {
            activityFeedItemsSelectCalls += 1;
            if (activityFeedItemsSelectCalls === 1) {
              return feedItemsSelectChain;
            }
            return remainingGroupMembersChain;
          },
          update: (payload: Record<string, unknown>) => {
            activityFeedItemsUpdateCalls += 1;
            if (activityFeedItemsUpdateCalls === 1) {
              return updateFeedItems(payload);
            }
            return updateFeedItemsForGroup(payload);
          },
        };
      }
      if (table === 'activity_feed_group_members') {
        return {
          select: () => {
            groupMembersSelectCalls += 1;
            return groupMembersSelectCalls === 1
              ? groupMembersSelectChain
              : remainingGroupMembersChain;
          },
          update: updateGroupMembers,
        };
      }
      return {};
    });

    await deleteMessageAction({ orgId: 'org-1', messageId: 'message-1' });

    expect(updateActivityEvents).toHaveBeenCalled();
    expect(updateFeedItems).toHaveBeenCalled();
    expect(updateGroupMembers).toHaveBeenCalled();
    expect(updateFeedItemsForGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        deleted_by: 'profile-1',
      }),
    );
  });
});

describe('toggleHiddenMessageAction', () => {
  it('toggles message hidden state after ownership checks', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

    const selectChain: any = {};
    selectChain.eq = vi.fn(() => selectChain);
    selectChain.maybeSingle = vi.fn(async () => ({
      data: { id: 'message-1', org_id: 'org-1', sender_profile_id: 'profile-1' },
    }));

    const hiddenUpdateChain: any = {};
    hiddenUpdateChain.eq = vi.fn(() => hiddenUpdateChain);
    hiddenUpdateChain.is = vi.fn(async () => ({ error: null }));
    const updateMessage = vi.fn(() => hiddenUpdateChain);

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { select: () => selectChain, update: updateMessage };
      }
      return {};
    });

    await toggleHiddenMessageAction({
      orgId: 'org-1',
      messageId: 'message-1',
      isHidden: true,
    });

    expect(updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        is_hidden: true,
      }),
    );
    expect(hiddenUpdateChain.eq).toHaveBeenCalledWith('id', 'message-1');
    expect(hiddenUpdateChain.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(hiddenUpdateChain.eq).toHaveBeenCalledWith('sender_profile_id', 'profile-1');
    expect(hiddenUpdateChain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('throws error if user is not the message owner', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    const { getProfileByAccountId } =
      await import('@iconicedu/web/lib/profile/queries/profiles.query');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);
    (
      getProfileByAccountId as unknown as { mockResolvedValueOnce: (value: any) => void }
    ).mockResolvedValueOnce({ data: { id: 'profile-2' } });

    const selectChain: any = {};
    selectChain.eq = vi.fn(() => selectChain);
    selectChain.maybeSingle = vi.fn(async () => ({
      data: { id: 'message-1', org_id: 'org-1', sender_profile_id: 'profile-1' },
    }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { select: () => selectChain };
      }
      return {};
    });

    await expect(
      toggleHiddenMessageAction({
        orgId: 'org-1',
        messageId: 'message-1',
        isHidden: true,
      }),
    ).rejects.toThrow('Unauthorized: You can only hide your own messages');
  });
});

describe('toggleSavedMessageAction', () => {
  it('upserts a per-profile saved message row', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

    const messageSelectChain: any = {};
    messageSelectChain.eq = vi.fn(() => messageSelectChain);
    messageSelectChain.is = vi.fn(() => messageSelectChain);
    messageSelectChain.maybeSingle = vi.fn(async () => ({
      data: { id: 'message-1', org_id: 'org-1', channel_id: 'channel-1' },
    }));

    const memberSelectChain: any = {};
    memberSelectChain.eq = vi.fn(() => memberSelectChain);
    memberSelectChain.is = vi.fn(() => memberSelectChain);
    memberSelectChain.maybeSingle = vi.fn(async () => ({ data: { id: 'member-1' } }));

    const upsertSave = vi.fn(async () => ({ error: null }));

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { select: () => messageSelectChain };
      }
      if (table === 'channel_members') {
        return { select: () => memberSelectChain };
      }
      if (table === 'message_saves') {
        return { upsert: upsertSave };
      }
      return {};
    });

    await toggleSavedMessageAction({
      orgId: 'org-1',
      messageId: 'message-1',
      isSaved: true,
    });

    expect(upsertSave).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        message_id: 'message-1',
        channel_id: 'channel-1',
        profile_id: 'profile-1',
        deleted_at: null,
      }),
      expect.objectContaining({
        onConflict: 'org_id,message_id,profile_id',
      }),
    );
  });

  it('soft deletes the saved message row when unsaving', async () => {
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user' } } })) },
      from: vi.fn(),
    };
    const { createSupabaseServerClient } =
      await import('@iconicedu/web/lib/supabase/server');
    (
      createSupabaseServerClient as unknown as { mockReturnValue: (value: any) => void }
    ).mockReturnValue(supabase);

    const messageSelectChain: any = {};
    messageSelectChain.eq = vi.fn(() => messageSelectChain);
    messageSelectChain.is = vi.fn(() => messageSelectChain);
    messageSelectChain.maybeSingle = vi.fn(async () => ({
      data: { id: 'message-1', org_id: 'org-1', channel_id: 'channel-1' },
    }));

    const memberSelectChain: any = {};
    memberSelectChain.eq = vi.fn(() => memberSelectChain);
    memberSelectChain.is = vi.fn(() => memberSelectChain);
    memberSelectChain.maybeSingle = vi.fn(async () => ({ data: { id: 'member-1' } }));

    const unsaveChain: any = {};
    unsaveChain.eq = vi.fn(() => unsaveChain);
    unsaveChain.is = vi.fn(async () => ({ error: null }));
    const updateSave = vi.fn(() => unsaveChain);

    supabase.from.mockImplementation((table: string) => {
      if (table === 'messages') {
        return { select: () => messageSelectChain };
      }
      if (table === 'channel_members') {
        return { select: () => memberSelectChain };
      }
      if (table === 'message_saves') {
        return { update: updateSave };
      }
      return {};
    });

    await toggleSavedMessageAction({
      orgId: 'org-1',
      messageId: 'message-1',
      isSaved: false,
    });

    expect(updateSave).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: expect.any(String),
        deleted_by: 'profile-1',
      }),
    );
    expect(unsaveChain.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(unsaveChain.eq).toHaveBeenCalledWith('message_id', 'message-1');
    expect(unsaveChain.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
    expect(unsaveChain.is).toHaveBeenCalledWith('deleted_at', null);
  });
});
