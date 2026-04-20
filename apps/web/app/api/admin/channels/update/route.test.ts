import { describe, expect, it, vi } from 'vitest';

import type { ChannelCreatePayload } from '@iconicedu/shared-types';
import { POST } from '@iconicedu/web/app/api/admin/channels/update/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const updateChannelFromPayload = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/admin/channel-update', () => ({
  updateChannelFromPayload: (...args: unknown[]) => updateChannelFromPayload(...args),
}));

describe('POST /api/admin/channels/update', () => {
  it('returns 400 when channelId is missing', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/admin/channels/update`, {
        method: 'POST',
        body: JSON.stringify({ payload: {} }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({
      success: false,
      message: 'Missing required channel fields.',
    });
  });

  it('updates channel when payload is valid', async () => {
    const payload: ChannelCreatePayload = {
      basics: {
        kind: 'channel',
        topic: 'Updates',
        iconKey: null,
        description: null,
        visibility: 'private',
        purpose: 'general',
      },
      ui: {
        themeKey: 'teal',
      },
      postingPolicy: {
        kind: 'members-only',
        allowThreads: true,
        allowReactions: true,
      },
      lifecycle: { status: 'active' },
      participants: [],
      capabilities: [],
    };

    updateChannelFromPayload.mockResolvedValueOnce(undefined);

    const response = await POST(
      new Request(`${APP_URL}/api/admin/channels/update`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1',
          payload,
        }),
      }),
    );

    expect(updateChannelFromPayload).toHaveBeenCalledWith('channel-1', payload);
    expect(response.status).toBe(200);
    const responsePayload = await response.json();
    expect(responsePayload).toEqual({ success: true });
  });
});
