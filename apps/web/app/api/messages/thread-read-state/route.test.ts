import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/messages/thread-read-state/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const rpc = vi.fn();
const threadMaybeSingle = vi.fn();
const participantMaybeSingle = vi.fn();
const messageMaybeSingle = vi.fn();
const APP_URL = resolveAppUrl();

const buildSelectChain = (maybeSingleMock: ReturnType<typeof vi.fn>) => ({
  eq: vi.fn(() => buildSelectChain(maybeSingleMock)),
  is: vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  })),
});

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    rpc,
    from: (table: string) => {
      if (table === 'threads') {
        return { select: vi.fn(() => buildSelectChain(threadMaybeSingle)) };
      }
      if (table === 'thread_participants') {
        return { select: vi.fn(() => buildSelectChain(participantMaybeSingle)) };
      }
      if (table === 'messages') {
        return { select: vi.fn(() => buildSelectChain(messageMaybeSingle)) };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  })),
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

describe('POST /api/messages/thread-read-state', () => {
  it('returns 400 when threadId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/messages/thread-read-state`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'threadId is required',
    });
  });

  it('returns 403 when thread is not accessible', async () => {
    threadMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/messages/thread-read-state`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1', threadId: 'thread-1' }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Thread not found or access denied',
    });
  });

  it('returns 403 when profile is not an active thread participant', async () => {
    threadMaybeSingle.mockResolvedValueOnce({
      data: { id: 'thread-1', channel_id: 'channel-1' },
      error: null,
    });
    participantMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/messages/thread-read-state`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1', threadId: 'thread-1' }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Thread not found or access denied',
    });
  });

  it('returns 400 when lastReadMessageId is not in thread', async () => {
    threadMaybeSingle.mockResolvedValueOnce({
      data: { id: 'thread-1', channel_id: 'channel-1' },
      error: null,
    });
    participantMaybeSingle.mockResolvedValueOnce({
      data: { id: 'participant-1' },
      error: null,
    });
    messageMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/messages/thread-read-state`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          threadId: 'thread-1',
          lastReadMessageId: 'message-x',
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Invalid lastReadMessageId for thread',
    });
  });

  it('recomputes unread and returns authoritative thread read-state response', async () => {
    threadMaybeSingle.mockResolvedValueOnce({
      data: { id: 'thread-1', channel_id: 'channel-1' },
      error: null,
    });
    participantMaybeSingle.mockResolvedValueOnce({
      data: { id: 'participant-1' },
      error: null,
    });
    messageMaybeSingle.mockResolvedValueOnce({ data: { id: 'message-2' }, error: null });
    rpc.mockResolvedValueOnce({ data: 0, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/messages/thread-read-state`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          threadId: 'thread-1',
          lastReadMessageId: 'message-2',
        }),
      }),
    );

    expect(rpc).toHaveBeenCalledWith('recompute_unread_for_account_thread', {
      p_org_id: 'org-1',
      p_channel_id: 'channel-1',
      p_thread_id: 'thread-1',
      p_account_id: 'account-1',
      p_last_read_message_id: 'message-2',
      p_last_read_at: expect.any(String),
      p_actor_profile_id: 'profile-1',
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        unreadCount: 0,
        lastReadMessageId: 'message-2',
        lastReadAt: expect.any(String),
      }),
    );
  });
});
