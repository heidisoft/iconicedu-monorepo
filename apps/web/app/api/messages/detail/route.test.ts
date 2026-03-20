import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/messages/detail/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const buildMessageById = vi.fn();
const requireEffectiveActorContext = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

vi.mock('@iconicedu/web/lib/messages/builders/message.builder', () => ({
  buildMessageById: (...args: unknown[]) => buildMessageById(...args),
}));

describe('GET /api/messages/detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1' },
    });
  });

  it('returns 400 when messageId is missing', async () => {
    const response = await GET(new Request(`${APP_URL}/api/messages/detail`));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'messageId is required' });
  });

  it('returns message payload', async () => {
    buildMessageById.mockResolvedValueOnce({ ids: { id: 'message-1', orgId: 'org-1' } });

    const response = await GET(
      new Request(`${APP_URL}/api/messages/detail?messageId=message-1`),
    );

    expect(buildMessageById).toHaveBeenCalledWith({}, 'org-1', 'message-1', {
      accountId: 'account-1',
      profileId: 'profile-1',
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      message: { ids: { id: 'message-1', orgId: 'org-1' } },
    });
  });
});
