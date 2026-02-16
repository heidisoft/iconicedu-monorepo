import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/(app)/d/messages/actions/read-state/route';

const upsert = vi.fn();
const channelMaybeSingle = vi.fn();
const messageMaybeSingle = vi.fn();

const buildSelectChain = (maybeSingleMock: ReturnType<typeof vi.fn>) => ({
  eq: vi.fn(() => buildSelectChain(maybeSingleMock)),
  is: vi.fn(() => ({
    maybeSingle: maybeSingleMock,
  })),
});

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'channel_read_state') {
        return {
          upsert,
        };
      }
      if (table === 'channels') {
        return {
          select: vi.fn(() => buildSelectChain(channelMaybeSingle)),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn(() => buildSelectChain(messageMaybeSingle)),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user' })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({ data: { id: 'account-1', org_id: 'org-1' } })),
}));

describe('POST /d/messages/actions/read-state', () => {
  it('returns 400 when channelId is missing', async () => {
    const response = await POST(
      new Request('http://localhost/d/messages/actions/read-state', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'channelId is required',
    });
  });

  it('upserts read-state with unread_count 0', async () => {
    channelMaybeSingle.mockResolvedValueOnce({ data: { id: 'channel-1' }, error: null });
    messageMaybeSingle.mockResolvedValueOnce({ data: { id: 'message-1' }, error: null });
    upsert.mockResolvedValueOnce({ error: null });

    const response = await POST(
      new Request('http://localhost/d/messages/actions/read-state', {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          lastReadMessageId: 'message-1',
        }),
      }),
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        account_id: 'account-1',
        channel_id: 'channel-1',
        last_read_message_id: 'message-1',
        unread_count: 0,
      }),
      { onConflict: 'org_id,channel_id,account_id' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('returns 403 when channel is not accessible', async () => {
    channelMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request('http://localhost/d/messages/actions/read-state', {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Channel not found or access denied',
    });
  });

  it('returns 400 when lastReadMessageId is not in channel', async () => {
    channelMaybeSingle.mockResolvedValueOnce({ data: { id: 'channel-1' }, error: null });
    messageMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request('http://localhost/d/messages/actions/read-state', {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          lastReadMessageId: 'message-x',
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Invalid lastReadMessageId for channel',
    });
  });
});
