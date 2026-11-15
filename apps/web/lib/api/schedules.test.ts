import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLearningSpaceEditContext } from './schedules';

describe('getLearningSpaceEditContext API client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('GETs the edit-context endpoint with scoped query params and the session bearer token', async () => {
    const context = {
      participantProfileIds: ['profile-1'],
      schedules: [],
      recurrences: [],
      exceptions: [],
      overrides: [],
      channel: null,
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(context), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const supabase = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { access_token: 'session-token' } },
        })),
      },
    } as unknown as SupabaseClient;

    const result = await getLearningSpaceEditContext(supabase, {
      orgId: 'org-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    });

    expect(result).toEqual(context);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toMatch(/\/schedules\/learning-space\/context$/);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      orgId: 'org-1',
      learningSpaceId: 'space-1',
      channelId: 'channel-1',
    });
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer session-token');
  });
});
