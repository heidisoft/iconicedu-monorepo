import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { publishActivityEvent } from './activity-publisher';

describe('publishActivityEvent', () => {
  const originalApiUrl = process.env.API_URL;
  const originalToken = process.env.INTERNAL_ACTIVITY_FEED_TOKEN;
  const fetchMock = vi.fn();
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'http://127.0.0.1:54321';
    process.env.INTERNAL_ACTIVITY_FEED_TOKEN = 'secret-token';
    vi.stubGlobal('fetch', fetchMock);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.API_URL = originalApiUrl;
    process.env.INTERNAL_ACTIVITY_FEED_TOKEN = originalToken;
    warnSpy.mockRestore();
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

  it('returns null when publishing fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
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
      payload: { messageId: 'message-3' },
    });

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('activity publish skipped'),
    );
  });

  it('returns null when activity publishing env vars are missing', async () => {
    process.env.API_URL = '';

    const result = await publishActivityEvent({
      supabase: {} as never,
      orgId: 'org-1',
      eventType: 'message.posted',
      sourceKind: 'profile',
      actorProfileId: 'profile-1',
      scope: { kind: 'learning_space', learningSpaceId: 'space-1' },
      payload: { messageId: 'message-4' },
    });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing_api_url'));
  });
});
