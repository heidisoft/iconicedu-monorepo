import { describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/messages/channel-files/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const buildChannelFiles = vi.fn();
const getProfileByAccountId = vi.fn();
const messagesQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  is: vi.fn(),
  returns: vi.fn(),
};
const supabase = {
  from: vi.fn(),
};
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => supabase),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user' })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({
    data: { id: 'account-1', org_id: 'org-1', active_profile_id: 'profile-1' },
  })),
}));

vi.mock('@iconicedu/web/lib/messages/builders/channel-messages.builder', () => ({
  buildChannelFiles: (...args: unknown[]) => buildChannelFiles(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: (...args: unknown[]) => getProfileByAccountId(...args),
}));

describe('GET /api/messages/channel-files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue(messagesQuery);
    messagesQuery.select.mockReturnValue(messagesQuery);
    messagesQuery.eq.mockReturnValue(messagesQuery);
    messagesQuery.in.mockReturnValue(messagesQuery);
    messagesQuery.is.mockReturnValue(messagesQuery);
    messagesQuery.returns.mockResolvedValue({ data: [] });
  });

  it('returns 400 when channelId is missing', async () => {
    const response = await GET(new Request(`${APP_URL}/api/messages/channel-files`));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'channelId is required' });
  });

  it('returns all files for a channel', async () => {
    buildChannelFiles.mockResolvedValueOnce([
      {
        ids: { id: 'file-1', orgId: 'org-1', channelId: 'channel-1' },
        messageId: 'message-1',
        kind: 'file',
        url: 'https://example.com/file-1.pdf',
        name: 'Worksheet.pdf',
        createdAt: '2026-02-22T10:00:00.000Z',
      },
    ]);
    messagesQuery.returns.mockResolvedValueOnce({
      data: [
        {
          id: 'message-1',
          sender_profile_id: 'profile-1',
          visibility_type: 'all',
          visibility_user_id: null,
          visibility_user_ids: null,
        },
      ],
    });

    const response = await GET(
      new Request(`${APP_URL}/api/messages/channel-files?channelId=channel-1`),
    );

    expect(buildChannelFiles).toHaveBeenCalledWith(supabase, 'org-1', 'channel-1');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      files: [
        {
          ids: { id: 'file-1', orgId: 'org-1', channelId: 'channel-1' },
          messageId: 'message-1',
          kind: 'file',
          url: 'https://example.com/file-1.pdf',
          name: 'Worksheet.pdf',
          createdAt: '2026-02-22T10:00:00.000Z',
        },
      ],
    });
  });

  it('filters files by message visibility_type for active profile', async () => {
    buildChannelFiles.mockResolvedValueOnce([
      {
        ids: { id: 'file-visible', orgId: 'org-1', channelId: 'channel-1' },
        messageId: 'message-visible',
        kind: 'file',
        url: 'https://example.com/visible.pdf',
        name: 'Visible.pdf',
        createdAt: '2026-02-22T10:00:00.000Z',
      },
      {
        ids: { id: 'file-hidden', orgId: 'org-1', channelId: 'channel-1' },
        messageId: 'message-hidden',
        kind: 'file',
        url: 'https://example.com/hidden.pdf',
        name: 'Hidden.pdf',
        createdAt: '2026-02-22T10:00:00.000Z',
      },
    ]);
    messagesQuery.returns.mockResolvedValueOnce({
      data: [
        {
          id: 'message-visible',
          sender_profile_id: 'profile-2',
          visibility_type: 'specific-users',
          visibility_user_id: null,
          visibility_user_ids: ['profile-1'],
        },
        {
          id: 'message-hidden',
          sender_profile_id: 'profile-2',
          visibility_type: 'specific-users',
          visibility_user_id: null,
          visibility_user_ids: ['profile-3'],
        },
      ],
    });

    const response = await GET(
      new Request(`${APP_URL}/api/messages/channel-files?channelId=channel-1`),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      files: [
        {
          ids: { id: 'file-visible', orgId: 'org-1', channelId: 'channel-1' },
          messageId: 'message-visible',
          kind: 'file',
          url: 'https://example.com/visible.pdf',
          name: 'Visible.pdf',
          createdAt: '2026-02-22T10:00:00.000Z',
        },
      ],
    });
  });
});
