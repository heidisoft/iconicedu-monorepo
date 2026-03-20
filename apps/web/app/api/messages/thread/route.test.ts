import { describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/messages/thread/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const buildMessagesByThreadId = vi.fn();
const requireEffectiveActorContextMock = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user' })),
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContextMock(...args),
}));

vi.mock('@iconicedu/web/lib/messages/builders/message.builder', () => ({
  buildMessagesByThreadId: (...args: unknown[]) => buildMessagesByThreadId(...args),
}));

describe('GET /api/messages/thread', () => {
  it('returns 400 when threadId is missing', async () => {
    const response = await GET(new Request(`${APP_URL}/api/messages/thread`));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'threadId is required' });
  });

  it('returns messages for thread payload', async () => {
    requireEffectiveActorContextMock.mockResolvedValueOnce({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
      source: 'primary',
    });
    buildMessagesByThreadId.mockResolvedValueOnce([
      { ids: { id: 'message-1', orgId: 'org-1' } },
    ]);

    const response = await GET(
      new Request(
        `${APP_URL}/api/messages/thread?threadId=thread-1&parentMessageId=message-parent`,
      ),
    );

    expect(buildMessagesByThreadId).toHaveBeenCalledWith({}, 'org-1', 'thread-1', {
      accountId: 'account-1',
      profileId: 'profile-1',
      parentMessageId: 'message-parent',
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      messages: [{ ids: { id: 'message-1', orgId: 'org-1' } }],
    });
  });
});
