import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiHttpError, createApiClient, createPublicApiClient } from './http-client';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('typed public and authenticated API clients', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  it('forwards an optional verified bearer token and does not cache public-info', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ exists: false }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await createPublicApiClient('synthetic-auth').get(
      '/live-sessions/demo/public-info',
      undefined,
      { cache: 'no-store' },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/live-sessions/demo/public-info'),
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer synthetic-auth',
        },
      }),
    );
  });
  it('keeps anonymous calls free of an authorization header', async () => {
    fetchMock.mockResolvedValue(
      new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    );
    await createPublicApiClient().post('/live-sessions/demo/guest-join', {
      passcode: 'demo',
    });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });
  it('preserves status codes and server validation messages', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Incorrect passcode' }), { status: 403 }),
    );
    await expect(
      createPublicApiClient().post('/live-sessions/demo/guest-join', {}),
    ).rejects.toMatchObject({ status: 403, message: 'Incorrect passcode' });
  });
  it('still rejects protected requests without authentication before sending them', async () => {
    const supabase = {
      auth: { getSession: async () => ({ data: { session: null } }) },
    } as unknown as SupabaseClient;
    await expect(createApiClient(supabase).get('/private')).rejects.toThrow(
      'Not authenticated',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('exposes a typed error for HTTP failures', () => {
    expect(new ApiHttpError(500, 'Unavailable')).toBeInstanceOf(Error);
  });
});
