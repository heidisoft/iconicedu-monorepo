import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/admin/channels/detail/route';
import { AdminOrgContextError } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const getChannelDetail = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/admin/channel-detail', () => ({
  getChannelDetail: (id: string) => getChannelDetail(id),
}));

describe('POST /api/admin/channels/detail', () => {
  it('returns 400 when channelId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/admin/channels/detail`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ success: false, message: 'channelId is required' });
  });

  it('returns detail payload', async () => {
    getChannelDetail.mockResolvedValueOnce({ ids: { id: 'channel-1', orgId: 'org-1' } });

    const response = await POST(
      new Request(`${APP_URL}/api/admin/channels/detail`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1' }),
      }),
    );

    expect(getChannelDetail).toHaveBeenCalledWith('channel-1');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      data: { ids: { id: 'channel-1', orgId: 'org-1' } },
    });
  });

  it('returns 403 when admin authorization fails', async () => {
    getChannelDetail.mockRejectedValueOnce(new Error('Forbidden'));

    const response = await POST(
      new Request(`${APP_URL}/api/admin/channels/detail`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1' }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Forbidden',
    });
  });

  it('preserves non-forbidden admin auth failure statuses', async () => {
    getChannelDetail.mockRejectedValueOnce(
      new AdminOrgContextError({
        ok: false,
        status: 403,
        message: 'Switch back to Parent to perform this action.',
      }),
    );

    const response = await POST(
      new Request(`${APP_URL}/api/admin/channels/detail`, {
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1' }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Switch back to Parent to perform this action.',
    });
  });
});
