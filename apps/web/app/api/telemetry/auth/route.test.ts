import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/telemetry/auth/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const APP_URL = resolveAppUrl();
const mockGetUser = vi.fn();
const mockInsert = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({ data: { id: 'account-1' } })),
}));

describe('POST /api/telemetry/auth', () => {
  it('rejects unsupported events', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/telemetry/auth`, {
        method: 'POST',
        body: JSON.stringify({ event: 'bad_event' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Invalid telemetry event',
    });
  });

  it('records allowed events', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'auth-1' } } });
    mockInsert.mockResolvedValueOnce({ error: null });

    const response = await POST(
      new Request(`${APP_URL}/api/telemetry/auth`, {
        method: 'POST',
        body: JSON.stringify({
          event: 'auth_start_email',
          payload: { source: 'test' },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockInsert).toHaveBeenCalled();
  });
});
