import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/admin/spaces/detail/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const getLearningSpaceDetail = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/admin/learning-space-detail', () => ({
  getLearningSpaceDetail: (...args: unknown[]) => getLearningSpaceDetail(...args),
}));

describe('POST /api/admin/spaces/detail', () => {
  it('returns 400 when learningSpaceId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/admin/spaces/detail`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  it('returns 403 when admin authorization fails', async () => {
    getLearningSpaceDetail.mockRejectedValueOnce(new Error('Forbidden'));

    const response = await POST(
      new Request(`${APP_URL}/api/admin/spaces/detail`, {
        method: 'POST',
        body: JSON.stringify({ learningSpaceId: 'space-1' }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Forbidden',
    });
  });
});
