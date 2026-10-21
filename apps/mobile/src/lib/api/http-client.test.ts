import { supabase } from '@/lib/supabase/client';
import { apiGet, publicApiGet, publicApiPost } from './http-client';
jest.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));
const session = {
  access_token: 'synthetic-access',
  refresh_token: 'synthetic-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'synthetic-user',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  },
};
describe('public API transport with optional signed-in identity', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.invalid';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    jest
      .mocked(supabase.auth.getSession)
      .mockResolvedValue({ data: { session: null }, error: null });
  });
  it('allows public meeting reads for guests without an Authorization header', async () => {
    await publicApiGet('/live-sessions/test/public-info');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.invalid/live-sessions/test/public-info',
      { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  });
  it('keeps signed-in identity on public joins and invitation secrets in the body', async () => {
    jest
      .mocked(supabase.auth.getSession)
      .mockResolvedValue({ data: { session }, error: null });
    await publicApiPost('/live-sessions/test/link-info', {
      token: 'synthetic-invitation',
      handoff: false,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.invalid/live-sessions/test/link-info',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer synthetic-access' }),
        body: JSON.stringify({ token: 'synthetic-invitation', handoff: false }),
      }),
    );
  });
  it('does not downgrade rejected authenticated requests to guest access', async () => {
    jest.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Session expired' }),
    } as Response);
    await expect(publicApiGet('/live-sessions/test/public-info')).rejects.toThrow(
      'Session expired',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('retains authentication requirements on private API calls', async () => {
    await expect(apiGet('/private')).rejects.toThrow('Not authenticated');
    expect(fetch).not.toHaveBeenCalled();
  });
});
