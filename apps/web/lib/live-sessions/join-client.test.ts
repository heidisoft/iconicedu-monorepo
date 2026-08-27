import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LiveSessionJoinError,
  requestLiveSessionJoin,
} from '@iconicedu/web/lib/live-sessions/join-client';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  if (typeof window === 'undefined') {
    vi.stubGlobal('window', { fetch: fetchMock });
  } else {
    window.fetch = fetchMock as unknown as typeof window.fetch;
  }
});

describe('requestLiveSessionJoin', () => {
  it('targets the exact occurrence when the caller knows which card was clicked', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, joinPath: '/iconic-academy/live-sessions/s-1' }),
    );

    const joinPath = await requestLiveSessionJoin({
      orgSlug: 'iconic-academy',
      channelId: 'channel-1',
      occurrence: {
        scheduleId: 'schedule-1',
        occurrenceKey: '2026-04-10T10:00:00.000Z',
      },
    });

    expect(joinPath).toBe('/iconic-academy/live-sessions/s-1');
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe('/api/live-sessions/class-sessions/join');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      orgSlug: 'iconic-academy',
      scheduleId: 'schedule-1',
      occurrenceKey: '2026-04-10T10:00:00.000Z',
    });
  });

  it('falls back to the channel endpoint when no occurrence is given', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, joinPath: '/iconic-academy/live-sessions/s-2' }),
    );

    await requestLiveSessionJoin({
      orgSlug: 'iconic-academy',
      channelId: 'channel-1',
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/channels/channel-1/live-sessions/join',
    );
  });

  it('surfaces a server denial instead of resolving to some other target', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: 'You do not have access to this class session.',
          reason: 'not_authorized',
        },
        403,
      ),
    );

    await expect(
      requestLiveSessionJoin({
        orgSlug: 'iconic-academy',
        channelId: 'channel-1',
      }),
    ).rejects.toMatchObject({
      message: 'You do not have access to this class session.',
      reason: 'not_authorized',
    });
  });

  it('treats a 200 without a join path as a failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await expect(
      requestLiveSessionJoin({ orgSlug: 'iconic-academy', channelId: 'channel-1' }),
    ).rejects.toBeInstanceOf(LiveSessionJoinError);
  });

  it('fails rather than calling an undefined channel endpoint', async () => {
    await expect(
      requestLiveSessionJoin({ orgSlug: 'iconic-academy', channelId: null }),
    ).rejects.toBeInstanceOf(LiveSessionJoinError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
