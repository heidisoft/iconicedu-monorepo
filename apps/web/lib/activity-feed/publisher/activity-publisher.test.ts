import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { publishActivityEvent } from './activity-publisher';

describe('publishActivityEvent', () => {
  const originalApiUrl = process.env.API_URL;
  const originalToken = process.env.INTERNAL_ACTIVITY_FEED_TOKEN;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'http://127.0.0.1:54321';
    process.env.INTERNAL_ACTIVITY_FEED_TOKEN = 'secret-token';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env.API_URL = originalApiUrl;
    process.env.INTERNAL_ACTIVITY_FEED_TOKEN = originalToken;
    vi.unstubAllGlobals();
  });

  it('delegates publishing to the internal API', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'event-1',
          org_id: 'org-1',
          dedupe_key: 'dedupe-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await publishActivityEvent({
      supabase: {} as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      sourceKind: 'profile',
      actorProfileId: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      payload: { messageId: 'message-1' },
      dedupeKey: 'dedupe-1',
    });

    expect(result?.id).toBe('event-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:54321/internal/activity-feed/publish',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
        body: JSON.stringify({
          orgId: 'org-1',
          eventType: 'message.posted',
          emitterLabel: undefined,
          occurredAt: undefined,
          sourceKind: 'profile',
          actorProfileId: 'profile-1',
          scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
          objectRef: null,
          targetRef: null,
          audienceRules: [],
          payload: { messageId: 'message-1' },
          dedupeKey: 'dedupe-1',
          createdBy: 'profile-1',
        }),
      }),
    );
  });

  it('returns null when the API suppresses the event', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('null', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await publishActivityEvent({
      supabase: {} as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      sourceKind: 'profile',
      actorProfileId: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      payload: { messageId: 'message-2' },
      dedupeKey: 'dedupe-2',
    });

    expect(result).toBeNull();
  });

  it('throws the API error message when publishing fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      publishActivityEvent({
        supabase: {} as never,
        orgId: 'org-1',
        eventType: 'message.posted',
        sourceKind: 'profile',
        actorProfileId: 'profile-1',
        scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
        payload: { messageId: 'message-3' },
      }),
    ).rejects.toThrow('Unauthorized');
  });
});
