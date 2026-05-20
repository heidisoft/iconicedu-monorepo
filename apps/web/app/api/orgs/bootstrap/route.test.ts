import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/orgs/bootstrap/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

describe('POST /api/orgs/bootstrap', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const response = await POST(
      new Request(`${APP_URL}/api/orgs/bootstrap`, {
        method: 'POST',
        body: JSON.stringify({ name: 'ICONIC Academy', slug: 'iconic' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Unauthorized',
    });
  });

  it('proxies the authenticated bootstrap request to apps/api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      new Request(`${APP_URL}/api/orgs/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'ICONIC Academy', slug: 'iconic' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]).toEqual([
      'http://localhost:3001/orgs/bootstrap',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'ICONIC Academy', slug: 'iconic' }),
      },
    ]);
  });
});
