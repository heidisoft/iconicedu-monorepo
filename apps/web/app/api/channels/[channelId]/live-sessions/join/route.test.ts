import { beforeEach, describe, expect, it, vi } from 'vitest';

const afterMock = vi.fn((callback: () => Promise<void>) => {
  void callback().catch(() => {});
});
const createOrJoinLiveSession = vi.fn();

vi.mock('next/server', () => ({
  after: (callback: () => Promise<void>) => afterMock(callback),
  NextResponse: {
    json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  },
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user-1' })),
}));

vi.mock('@iconicedu/web/lib/live-sessions/service', () => ({
  createOrJoinLiveSession: (...args: unknown[]) => createOrJoinLiveSession(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}));

import { POST } from '@iconicedu/web/app/api/channels/[channelId]/live-sessions/join/route';

describe('POST /api/channels/[channelId]/live-sessions/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the join payload and schedules post-join side effects with after', async () => {
    createOrJoinLiveSession.mockImplementationOnce(async (input) => {
      input.schedulePostJoinSideEffects(async () => {});
      return {
        sessionId: 'live-session-1',
        joinPath: 'https://meet.example.com/custom-room',
        status: 'live',
        created: true,
        provider: 'custom',
      };
    });

    const response = await POST(
      new Request(
        'https://app.iconicedu.test/api/channels/channel-1/live-sessions/join',
        {
          method: 'POST',
          body: JSON.stringify({ orgSlug: 'iconic-academy' }),
        },
      ),
      { params: Promise.resolve({ channelId: 'channel-1' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'live-session-1',
      joinPath: 'https://meet.example.com/custom-room',
      status: 'live',
      created: true,
      provider: 'custom',
    });
    expect(afterMock).toHaveBeenCalledTimes(1);
  });

  it('still returns 200 when deferred activity work throws', async () => {
    createOrJoinLiveSession.mockImplementationOnce(async (input) => {
      input.schedulePostJoinSideEffects(async () => {
        throw new Error('activity failed');
      });
      return {
        sessionId: 'live-session-1',
        joinPath: '/iconic-academy/live-sessions/live-session-1',
        status: 'live',
        created: true,
        provider: 'daily',
      };
    });

    const response = await POST(
      new Request(
        'https://app.iconicedu.test/api/channels/channel-1/live-sessions/join',
        {
          method: 'POST',
          body: JSON.stringify({ orgSlug: 'iconic-academy' }),
        },
      ),
      { params: Promise.resolve({ channelId: 'channel-1' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'live-session-1',
      joinPath: '/iconic-academy/live-sessions/live-session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });
  });
});
