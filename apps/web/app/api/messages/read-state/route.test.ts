import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/messages/read-state/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const rpc = vi.fn();
const requireEffectiveActorContext = vi.fn();
const channelMaybeSingle = vi.fn();
const messageMaybeSingle = vi.fn();
const memberMaybeSingle = vi.fn();
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
      if (table === 'channels') {
        return {
          select: vi.fn(() => buildSelectChain(channelMaybeSingle)),
        };
      }
      if (table === 'channel_members') {
        return {
          select: vi.fn(() => buildSelectChain(memberMaybeSingle)),
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

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

describe('POST /api/messages/read-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
    });
  });

  it('returns 400 when channelId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
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

  it('recomputes unread from source of truth for channel read-state', async () => {
    channelMaybeSingle.mockResolvedValueOnce({ data: { id: 'channel-1' }, error: null });
    memberMaybeSingle.mockResolvedValueOnce({ data: { id: 'member-1' }, error: null });
    messageMaybeSingle.mockResolvedValueOnce({ data: { id: 'message-1' }, error: null });
    rpc.mockResolvedValueOnce({ data: 0, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          lastReadMessageId: 'message-1',
        }),
      }),
    );

    expect(rpc).toHaveBeenCalledWith('recompute_unread_for_account_channel', {
      p_org_id: 'org-1',
      p_channel_id: 'channel-1',
      p_account_id: 'account-1',
      p_last_read_message_id: 'message-1',
      p_last_read_at: expect.any(String),
      p_actor_profile_id: 'profile-1',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, unreadCount: 0 });
  });

  it('returns 403 when channel is not accessible', async () => {
    channelMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
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
    memberMaybeSingle.mockResolvedValueOnce({ data: { id: 'member-1' }, error: null });
    messageMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
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

  it('returns 403 when account profile is not an active channel member', async () => {
    channelMaybeSingle.mockResolvedValueOnce({ data: { id: 'channel-1' }, error: null });
    memberMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/messages/read-state`, {
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
});
