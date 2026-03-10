/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

import { POST } from '@iconicedu/web/app/api/presence/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const upsert = vi.fn();
const getUser = vi.fn(async () => ({ data: { user: { id: 'auth-user' } } }));
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    from: () => ({
      upsert,
    }),
  })),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: vi.fn(async () => ({
    data: { id: 'account-1', org_id: 'org-1' },
  })),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: vi.fn(async () => ({ data: { id: 'profile-1' } })),
}));

describe('POST /api/presence', () => {
  it('returns 400 for invalid json body', async () => {
    const response = await POST(
      new Request(`${APP_URL}/api/presence`, {
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
      new Request(`${APP_URL}/api/presence`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        profile_id: 'profile-1',
        live_status: 'in_class',
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
      new Request(`${APP_URL}/api/presence`, {
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

  it('does not clear status override fields when omitted', async () => {
    upsert.mockResolvedValueOnce({ error: null });

    await POST(
      new Request(`${APP_URL}/api/presence`, {
        method: 'POST',
        body: JSON.stringify({ status: 'online' }),
      }),
    );

    const lastCall = upsert.mock.calls[upsert.mock.calls.length - 1] as
      | [Record<string, unknown>]
      | undefined;
    const payload = (lastCall?.[0] ?? {}) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('state_text');
    expect(payload).not.toHaveProperty('state_emoji');
    expect(payload).not.toHaveProperty('state_expires_at');
  });

  it('persists explicit status override fields when provided', async () => {
    upsert.mockResolvedValueOnce({ error: null });

    await POST(
      new Request(`${APP_URL}/api/presence`, {
        method: 'POST',
        body: JSON.stringify({
          stateText: 'In a meeting',
          stateEmoji: '📅',
          stateExpiresAt: '2026-02-16T12:00:00.000Z',
        }),
      }),
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        state_text: 'In a meeting',
        state_emoji: '📅',
        state_expires_at: '2026-02-16T12:00:00.000Z',
      }),
      { onConflict: 'org_id,profile_id' },
    );
  });

  it('clears status override when clearState is true', async () => {
    upsert.mockResolvedValueOnce({ error: null });

    await POST(
      new Request(`${APP_URL}/api/presence`, {
        method: 'POST',
        body: JSON.stringify({ clearState: true }),
      }),
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        state_text: null,
        state_emoji: null,
        state_expires_at: null,
      }),
      { onConflict: 'org_id,profile_id' },
    );
  });

  it('returns 401 when auth user is missing', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } } as any);

    const response = await POST(
      new Request(`${APP_URL}/api/presence`, {
        method: 'POST',
        body: JSON.stringify({ status: 'online' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Unauthorized',
    });
  });
});
