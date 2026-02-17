import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/(app)/d/admin/channels/actions/detail/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const getChannelDetail = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/admin/channel-detail', () => ({
  getChannelDetail: (id: string) => getChannelDetail(id),
}));

describe('POST /d/admin/channels/actions/detail', () => {
  it('returns 400 when channelId is missing', async () => {
    const response = await POST(
      new Request(, {
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
      new Request(, {
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
});
