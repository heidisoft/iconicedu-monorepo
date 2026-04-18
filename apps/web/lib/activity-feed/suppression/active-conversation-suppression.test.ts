import { describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_CONVERSATION_SUPPRESSION_WINDOW_MS,
  resolveActiveConversationSuppressedRecipients,
} from '@iconicedu/web/lib/activity-feed/suppression/active-conversation-suppression';

function createSupabaseMock(input: {
  profiles?: Array<{ id: string; account_id: string | null }>;
  presence?: Array<{
    profile_id: string;
    live_status: string | null;
    last_seen_at: string | null;
  }>;
  readStates?: Array<{ account_id: string; last_read_at: string | null }>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({ data: input.profiles ?? [], error: null })),
        };
        return { select: vi.fn(() => chain) };
      }
      if (table === 'profile_presence') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({ data: input.presence ?? [], error: null })),
        };
        return { select: vi.fn(() => chain) };
      }
      if (table === 'channel_read_state') {
        const chain = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          is: vi.fn(() => chain),
          returns: vi.fn(async () => ({ data: input.readStates ?? [], error: null })),
        };
        return { select: vi.fn(() => chain) };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('resolveActiveConversationSuppressedRecipients', () => {
  it('suppresses recipients when presence is active and read state is recent', async () => {
    const supabase = createSupabaseMock({
      profiles: [{ id: 'profile-1', account_id: 'account-1' }],
      presence: [
        {
          profile_id: 'profile-1',
          live_status: 'online',
          last_seen_at: '2026-03-12T10:00:45.000Z',
        },
      ],
      readStates: [{ account_id: 'account-1', last_read_at: '2026-03-12T10:00:30.000Z' }],
    });

    const result = await resolveActiveConversationSuppressedRecipients({
      supabase: supabase as never,
      event: {
        org_id: 'org-1',
        event_type: 'message.posted',
        scope: { kind: 'channel', channelId: 'channel-1' },
        payload: {},
        occurred_at: '2026-03-12T10:01:00.000Z',
      } as never,
      recipientProfileIds: ['profile-1'],
      now: '2026-03-12T10:01:00.000Z',
    });

    expect(result.channelId).toBe('channel-1');
    expect(result.suppressedProfileIds).toEqual(['profile-1']);
    expect(result.recipientProfileIds).toEqual([]);
  });

  it('does not suppress when only one active signal is present', async () => {
    const supabase = createSupabaseMock({
      profiles: [{ id: 'profile-1', account_id: 'account-1' }],
      presence: [
        {
          profile_id: 'profile-1',
          live_status: 'online',
          last_seen_at: '2026-03-12T10:00:45.000Z',
        },
      ],
      readStates: [{ account_id: 'account-1', last_read_at: null }],
    });

    const result = await resolveActiveConversationSuppressedRecipients({
      supabase: supabase as never,
      event: {
        org_id: 'org-1',
        event_type: 'message.posted',
        scope: { kind: 'channel', channelId: 'channel-1' },
        payload: {},
        occurred_at: '2026-03-12T10:01:00.000Z',
      } as never,
      recipientProfileIds: ['profile-1'],
      now: '2026-03-12T10:01:00.000Z',
    });

    expect(result.suppressedProfileIds).toEqual([]);
    expect(result.recipientProfileIds).toEqual(['profile-1']);
  });

  it('does not suppress when channel id cannot be resolved', async () => {
    const supabase = createSupabaseMock({
      profiles: [{ id: 'profile-1', account_id: 'account-1' }],
      presence: [
        {
          profile_id: 'profile-1',
          live_status: 'online',
          last_seen_at: '2026-03-12T10:00:45.000Z',
        },
      ],
      readStates: [{ account_id: 'account-1', last_read_at: '2026-03-12T10:00:30.000Z' }],
    });

    const result = await resolveActiveConversationSuppressedRecipients({
      supabase: supabase as never,
      event: {
        org_id: 'org-1',
        event_type: 'message.posted',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        payload: {},
        occurred_at: '2026-03-12T10:01:00.000Z',
      } as never,
      recipientProfileIds: ['profile-1'],
      now: '2026-03-12T10:01:00.000Z',
    });

    expect(result.channelId).toBe(null);
    expect(result.suppressedProfileIds).toEqual([]);
    expect(result.recipientProfileIds).toEqual(['profile-1']);
  });

  it('respects exact suppression boundary', async () => {
    const now = '2026-03-12T10:01:00.000Z';
    const nowTime = new Date(now).getTime();
    const cutoff = new Date(
      nowTime - ACTIVE_CONVERSATION_SUPPRESSION_WINDOW_MS,
    ).toISOString();
    const supabase = createSupabaseMock({
      profiles: [{ id: 'profile-1', account_id: 'account-1' }],
      presence: [
        {
          profile_id: 'profile-1',
          live_status: 'teaching',
          last_seen_at: '2026-03-12T10:00:50.000Z',
        },
      ],
      readStates: [{ account_id: 'account-1', last_read_at: cutoff }],
    });

    const result = await resolveActiveConversationSuppressedRecipients({
      supabase: supabase as never,
      event: {
        org_id: 'org-1',
        event_type: 'dm.posted',
        scope: { kind: 'channel', channelId: 'channel-1' },
        payload: {},
        occurred_at: now,
      } as never,
      recipientProfileIds: ['profile-1'],
      now,
    });

    expect(result.suppressedProfileIds).toEqual(['profile-1']);
    expect(result.recipientProfileIds).toEqual([]);
  });

  it('does not suppress when active presence is stale even if read state is recent', async () => {
    const supabase = createSupabaseMock({
      profiles: [{ id: 'profile-1', account_id: 'account-1' }],
      presence: [
        {
          profile_id: 'profile-1',
          live_status: 'in_class',
          last_seen_at: '2026-03-12T09:54:59.000Z',
        },
      ],
      readStates: [{ account_id: 'account-1', last_read_at: '2026-03-12T10:00:30.000Z' }],
    });

    const result = await resolveActiveConversationSuppressedRecipients({
      supabase: supabase as never,
      event: {
        org_id: 'org-1',
        event_type: 'dm.posted',
        scope: { kind: 'channel', channelId: 'channel-1' },
        payload: {},
        occurred_at: '2026-03-12T10:01:00.000Z',
      } as never,
      recipientProfileIds: ['profile-1'],
      now: '2026-03-12T10:01:00.000Z',
    });

    expect(result.suppressedProfileIds).toEqual([]);
    expect(result.recipientProfileIds).toEqual(['profile-1']);
  });
});
