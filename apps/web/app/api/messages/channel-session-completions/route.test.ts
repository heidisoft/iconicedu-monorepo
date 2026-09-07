import { describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/messages/channel-session-completions/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const listChannelSessionCompletions = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user' })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({
    data: { id: 'account-1', org_id: 'org-1' },
  })),
}));

vi.mock('@iconicedu/web/lib/api/session-completions', () => ({
  listChannelSessionCompletions: (...args: unknown[]) =>
    listChannelSessionCompletions(...args),
}));

describe('GET /api/messages/channel-session-completions', () => {
  it('returns 400 when channelId is missing', async () => {
    const response = await GET(
      new Request(`${APP_URL}/api/messages/channel-session-completions`),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'channelId is required',
    });
  });

  it('returns the confirmed and disputed occurrences for the channel', async () => {
    listChannelSessionCompletions.mockResolvedValueOnce({
      completions: [
        { scheduleId: 'schedule-1', occurrenceKey: '2026-03-03T16:00:00+00:00' },
      ],
      disputed: [
        { scheduleId: 'schedule-1', occurrenceKey: '2026-03-10T16:00:00+00:00' },
      ],
    });

    const response = await GET(
      new Request(
        `${APP_URL}/api/messages/channel-session-completions?channelId=channel-1`,
      ),
    );

    expect(listChannelSessionCompletions).toHaveBeenCalledWith(
      {},
      { orgId: 'org-1', channelId: 'channel-1' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      completions: [
        { scheduleId: 'schedule-1', occurrenceKey: '2026-03-03T16:00:00+00:00' },
      ],
      disputed: [
        { scheduleId: 'schedule-1', occurrenceKey: '2026-03-10T16:00:00+00:00' },
      ],
    });
  });
});
