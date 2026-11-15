import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getClassScheduleSessionContext,
  getLearningSpaceEditContext,
  getScheduleCalendar,
} from './schedules';

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

describe('getScheduleCalendar API client', () => {
  const fetchMock = vi.fn();
  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'session-token' } },
      })),
    },
  } as unknown as SupabaseClient;

  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('GETs /schedules/calendar with orgId and the session bearer token', async () => {
    const schedules = [{ ids: { id: 'schedule-1', orgId: 'org-1' } }];
    fetchMock.mockResolvedValue(jsonResponse(schedules));

    const result = await getScheduleCalendar(supabase, { orgId: 'org-1' });

    expect(result).toEqual(schedules);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toMatch(/\/schedules\/calendar$/);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ orgId: 'org-1' });
    expect(init.headers.Authorization).toBe('Bearer session-token');
  });

  it('sends scheduleIds as a comma-separated list', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await getScheduleCalendar(supabase, { orgId: 'org-1', scheduleIds: ['a', 'b'] });

    const parsed = new URL(fetchMock.mock.calls[0][0]);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      orgId: 'org-1',
      scheduleIds: 'a,b',
    });
  });

  it('never sends an empty scheduleIds filter (it would widen to every org schedule)', async () => {
    await expect(
      getScheduleCalendar(supabase, { orgId: 'org-1', scheduleIds: [] }),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes a non-array body to an empty list', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(getScheduleCalendar(supabase, { orgId: 'org-1' })).resolves.toEqual([]);
  });

  it('propagates API errors so callers can decide how to degrade', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'nope' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getScheduleCalendar(supabase, { orgId: 'org-1' })).rejects.toThrow(
      'nope',
    );
  });
});

describe('getClassScheduleSessionContext API client', () => {
  const fetchMock = vi.fn();
  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'session-token' } },
      })),
    },
  } as unknown as SupabaseClient;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('GETs /schedules/session/context with orgId, scheduleId, and the bearer token', async () => {
    const context = {
      scheduleId: 'schedule-1',
      title: 'Algebra',
      startAt: '2026-03-21T14:00:00.000Z',
      endAt: '2026-03-21T15:00:00.000Z',
      timezone: 'America/New_York',
      sourceLearningSpaceId: 'space-1',
      sourceChannelId: 'channel-1',
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(context), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      getClassScheduleSessionContext(supabase, {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
      }),
    ).resolves.toEqual(context);

    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toMatch(/\/schedules\/session\/context$/);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      orgId: 'org-1',
      scheduleId: 'schedule-1',
    });
    expect(init.headers.Authorization).toBe('Bearer session-token');
  });

  // Contract: these are the exact NestJS 400 bodies the API returns. The thrown
  // message must equal what apps/web used to throw itself before the check moved
  // server-side, so the error the user sees is unchanged.
  it.each([['Archived classrooms cannot be changed.'], ['Schedule not found']])(
    'rejects with the API message verbatim: %s',
    async (message) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ statusCode: 400, message, error: 'Bad Request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const error = await getClassScheduleSessionContext(supabase, {
        orgId: 'org-1',
        scheduleId: 'schedule-1',
      }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(message);
      expect((error as { status?: number }).status).toBe(400);
    },
  );
});
