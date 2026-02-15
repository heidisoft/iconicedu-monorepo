import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/(app)/d/messages/actions/read-state/route';

const upsert = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: () => ({
      upsert,
    }),
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
});
