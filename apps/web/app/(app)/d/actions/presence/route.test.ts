import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/(app)/d/actions/presence/route';

const upsert = vi.fn();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: () => ({
      upsert,
    }),
  })),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: vi.fn(async () => ({ id: 'auth-user' })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({ data: { id: 'account-1', org_id: 'org-1' } })),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(async () => ({ data: { id: 'profile-1' } })),
}));

describe('POST /d/actions/presence', () => {
  it('returns 400 for invalid json body', async () => {
    const response = await POST(
      new Request('http://localhost/d/actions/presence', {
        method: 'POST',
        body: '{invalid',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Invalid JSON body',
    });
  });

  it('upserts online presence by default', async () => {
    upsert.mockResolvedValueOnce({ error: null });

    const response = await POST(
      new Request('http://localhost/d/actions/presence', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        profile_id: 'profile-1',
        live_status: 'online',
        display_status: 'online',
        presence_loaded: true,
      }),
      { onConflict: 'org_id,profile_id' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('upserts away presence when status is away', async () => {
    upsert.mockResolvedValueOnce({ error: null });

    await POST(
      new Request('http://localhost/d/actions/presence', {
        method: 'POST',
        body: JSON.stringify({ status: 'away' }),
      }),
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        live_status: 'away',
        display_status: 'away',
      }),
      { onConflict: 'org_id,profile_id' },
    );
  });
});
