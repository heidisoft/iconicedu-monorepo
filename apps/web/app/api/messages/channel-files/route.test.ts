import { describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/messages/channel-files/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const buildChannelFiles = vi.fn();
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

vi.mock('@iconicedu/web/lib/messages/builders/channel-messages.builder', () => ({
  buildChannelFiles: (...args: unknown[]) => buildChannelFiles(...args),
}));

describe('GET /api/messages/channel-files', () => {
  it('returns 400 when channelId is missing', async () => {
    const response = await GET(
      new Request(`${APP_URL}/api/messages/channel-files`),
    );
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'channelId is required' });
  });

  it('returns all files for a channel', async () => {
    buildChannelFiles.mockResolvedValueOnce([
      {
        ids: { id: 'file-1', orgId: 'org-1', channelId: 'channel-1' },
        kind: 'file',
        url: 'https://example.com/file-1.pdf',
        name: 'Worksheet.pdf',
        createdAt: '2026-02-22T10:00:00.000Z',
      },
    ]);

    const response = await GET(
      new Request(`${APP_URL}/api/messages/channel-files?channelId=channel-1`),
    );

    expect(buildChannelFiles).toHaveBeenCalledWith({}, 'org-1', 'channel-1');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      files: [
        {
          ids: { id: 'file-1', orgId: 'org-1', channelId: 'channel-1' },
          kind: 'file',
          url: 'https://example.com/file-1.pdf',
          name: 'Worksheet.pdf',
          createdAt: '2026-02-22T10:00:00.000Z',
        },
      ],
    });
  });
});
