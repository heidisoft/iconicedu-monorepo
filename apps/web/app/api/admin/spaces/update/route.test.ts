import { describe, expect, it, vi, beforeEach } from 'vitest';

import { POST } from '@iconicedu/web/app/api/admin/spaces/update/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const createSupabaseServerClientMock = vi.fn();
const requireParentActorContextMock = vi.fn();
const updateLearningSpaceFromPayloadMock = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireParentActorContext: (...args: unknown[]) =>
    requireParentActorContextMock(...args),
}));

vi.mock('@iconicedu/web/lib/admin/learning-space-update', () => ({
  updateLearningSpaceFromPayload: (...args: unknown[]) =>
    updateLearningSpaceFromPayloadMock(...args),
}));

describe('POST /api/admin/spaces/update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when required payload fields are missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/admin/spaces/update`, {
        method: 'POST',
        body: JSON.stringify({ learningSpaceId: 'space-1' }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it('returns 401 when user is not authenticated', async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
      },
    });

    const response = await POST(
      new Request(`${APP_URL}/api/admin/spaces/update`, {
        method: 'POST',
        body: JSON.stringify({
          learningSpaceId: 'space-1',
          payload: {
            basics: {
              title: 'Math',
              kind: 'small_group',
              iconKey: 'book-open',
            },
            participants: [{ profileId: 'profile-1' }],
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(updateLearningSpaceFromPayloadMock).not.toHaveBeenCalled();
  });

  it('passes current profile context into learning space update', async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } } })),
      },
    });
    requireParentActorContextMock.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-actor-1', account_id: 'account-1', org_id: 'org-1' },
      source: 'parent',
    });
    updateLearningSpaceFromPayloadMock.mockResolvedValue(undefined);

    const payload = {
      basics: {
        title: 'Math',
        kind: 'small_group',
        iconKey: 'book-open',
      },
      participants: [{ profileId: 'profile-1' }],
    };

    const response = await POST(
      new Request(`${APP_URL}/api/admin/spaces/update`, {
        method: 'POST',
        body: JSON.stringify({
          learningSpaceId: 'space-1',
          payload,
          sendActivityNotifications: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateLearningSpaceFromPayloadMock).toHaveBeenCalledWith(
      'space-1',
      payload,
      {
        orgId: 'org-1',
        actorProfileId: 'profile-actor-1',
      },
      {
        sendActivityNotifications: false,
      },
    );
  });
});
