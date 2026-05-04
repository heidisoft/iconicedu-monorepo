import { describe, expect, it, vi, beforeEach } from 'vitest';

import { POST } from '@iconicedu/web/app/api/admin/spaces/update/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const requireAdminAuthContextMock = vi.fn();
const updateLearningSpaceFromPayloadMock = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/admin/_auth-context', () => ({
  requireAdminAuthContext: (...args: unknown[]) => requireAdminAuthContextMock(...args),
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
    requireAdminAuthContextMock.mockRejectedValue(new Error('Unauthorized'));

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
    requireAdminAuthContextMock.mockResolvedValue({
      orgId: 'org-1',
      profileId: 'profile-actor-1',
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
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateLearningSpaceFromPayloadMock).toHaveBeenCalledWith('space-1', payload, {
      orgId: 'org-1',
      actorProfileId: 'profile-actor-1',
    });
  });
});
