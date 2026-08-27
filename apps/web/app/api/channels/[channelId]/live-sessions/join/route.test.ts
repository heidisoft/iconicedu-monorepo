import { beforeEach, describe, expect, it, vi } from 'vitest';

const joinChannelLiveSession = vi.fn();
const requireEffectiveActorContext = vi.fn();

vi.mock('next/server', () => ({
  NextResponse: {
    json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  },
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

vi.mock('@iconicedu/web/lib/org/queries/org.query', () => ({
  getOrgBySlug: vi.fn(async () => ({
    data: { id: 'org-1', slug: 'iconic-academy' },
    error: null,
  })),
}));

vi.mock('@iconicedu/web/lib/live-sessions/api-client', () => ({
  createLiveSessionsApiClient: () => ({
    joinChannelLiveSession: (...args: unknown[]) => joinChannelLiveSession(...args),
  }),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}));

import { POST } from '@iconicedu/web/app/api/channels/[channelId]/live-sessions/join/route';

function buildRequest(body: unknown) {
  return new Request(
    'https://app.iconicedu.test/api/channels/channel-1/live-sessions/join',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

const params = Promise.resolve({ channelId: 'channel-1' });

describe('POST /api/channels/[channelId]/live-sessions/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      authUserId: 'auth-user-1',
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1', kind: 'guardian', account_id: 'account-1' },
      isViewingAsChild: false,
    });
  });

  it('forwards the effective actor to the API and returns the join payload', async () => {
    joinChannelLiveSession.mockResolvedValueOnce({
      sessionId: 'live-session-1',
      joinPath: '/iconic-academy/live-sessions/live-session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });

    const response = await POST(buildRequest({ orgSlug: 'iconic-academy' }), { params });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      sessionId: 'live-session-1',
      joinPath: '/iconic-academy/live-sessions/live-session-1',
      status: 'live',
      created: true,
      provider: 'daily',
    });
    expect(joinChannelLiveSession).toHaveBeenCalledWith({
      channelId: 'channel-1',
      orgSlug: 'iconic-academy',
      actingProfileId: 'profile-1',
    });
  });

  it('attributes the join to the child a guardian is viewing as', async () => {
    requireEffectiveActorContext.mockResolvedValue({
      authUserId: 'auth-user-1',
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-child-1', kind: 'child', account_id: 'account-child-1' },
      isViewingAsChild: true,
    });
    joinChannelLiveSession.mockResolvedValueOnce({
      sessionId: 'live-session-1',
      joinPath: '/iconic-academy/live-sessions/live-session-1',
      status: 'live',
      created: false,
      provider: 'daily',
    });

    await POST(buildRequest({ orgSlug: 'iconic-academy' }), { params });

    expect(joinChannelLiveSession).toHaveBeenCalledWith(
      expect.objectContaining({ actingProfileId: 'profile-child-1' }),
    );
  });

  it('rejects a request without an org slug before calling the API', async () => {
    const response = await POST(buildRequest({}), { params });

    expect(response.status).toBe(400);
    expect(joinChannelLiveSession).not.toHaveBeenCalled();
  });

  it('maps an API denial to a user-safe 403 rather than a generic failure', async () => {
    joinChannelLiveSession.mockRejectedValueOnce(new Error('not_authorized'));

    const response = await POST(buildRequest({ orgSlug: 'iconic-academy' }), { params });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: 'You do not have access to this class session.',
      reason: 'not_authorized',
    });
  });

  it('maps an archived classroom denial to a conflict', async () => {
    joinChannelLiveSession.mockRejectedValueOnce(new Error('classroom_archived'));

    const response = await POST(buildRequest({ orgSlug: 'iconic-academy' }), { params });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      reason: 'classroom_archived',
    });
  });
});
