import { describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/(app)/d/messages/actions/channel-page/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const buildMessagesPageByChannelId = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user' })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({ data: { id: 'account-1', org_id: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/messages/builders/message.builder', () => ({
  buildMessagesPageByChannelId: (...args: unknown[]) =>
    buildMessagesPageByChannelId(...args),
}));

describe('GET /d/messages/actions/channel-page', () => {
  it('returns 400 when channelId is missing', async () => {
    const response = await GET(
      new Request(`${APP_URL}/d/messages/actions/channel-page`),
    );
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'channelId is required' });
  });

  it('returns paged message payload', async () => {
    buildMessagesPageByChannelId.mockResolvedValueOnce({
      messages: [{ ids: { id: 'message-1', orgId: 'org-1' } }],
      hasMore: true,
      nextCursor: '2026-02-15T10:00:00.000Z',
    });

    const response = await GET(
      new Request(
        `${APP_URL}/d/messages/actions/channel-page?channelId=channel-1&before=2026-02-15T11%3A00%3A00.000Z&limit=40`,
      ),
    );

    expect(buildMessagesPageByChannelId).toHaveBeenCalledWith({}, 'org-1', 'channel-1', {
      beforeCreatedAt: '2026-02-15T11:00:00.000Z',
      limit: 40,
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      messages: [{ ids: { id: 'message-1', orgId: 'org-1' } }],
      hasMore: true,
      nextCursor: '2026-02-15T10:00:00.000Z',
    });
  });
});
