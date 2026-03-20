import { describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/messages/file-download/route';

const APP_URL = 'https://app.iconicedu.test';
const requireEffectiveActorContext = vi.fn();
const maybeSingle = vi.fn(async () => ({ data: { id: 'member-1' } }));
const limit = vi.fn(() => ({ maybeSingle }));
const is = vi.fn(() => ({ limit }));
const eqProfileId = vi.fn(() => ({ is }));
const eqChannelId = vi.fn(() => ({ eq: eqProfileId }));
const eqOrgId = vi.fn(() => ({ eq: eqChannelId }));
const select = vi.fn(() => ({ eq: eqOrgId }));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === 'channel_members') {
        return { select };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  })),
}));

vi.mock('@iconicedu/web/lib/family-view/actor-context', () => ({
  requireEffectiveActorContext: (...args: unknown[]) =>
    requireEffectiveActorContext(...args),
}));

vi.mock('@iconicedu/web/lib/messages/queries/file-url.query', () => ({
  createSignedChannelFileUrl: vi.fn(async () => 'https://signed.example.com/file.pdf'),
}));

describe('GET /api/messages/file-download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEffectiveActorContext.mockResolvedValue({
      account: { id: 'account-1', org_id: 'org-1' },
      profile: { id: 'profile-1', org_id: 'org-1' },
    });
    maybeSingle.mockResolvedValue({ data: { id: 'member-1' } });
  });

  it('returns 400 when path is missing', async () => {
    const response = await GET(new Request(`${APP_URL}/api/messages/file-download`));

    expect(response.status).toBe(400);
  });

  it('returns 403 when the path org does not match the signed-in account org', async () => {
    const response = await GET(
      new Request(
        `${APP_URL}/api/messages/file-download?path=org-2/channel-1/profile-1/file.pdf`,
      ),
    );

    expect(response.status).toBe(403);
  });

  it('redirects to a fresh signed url when the user belongs to the file org', async () => {
    const response = await GET(
      new Request(
        `${APP_URL}/api/messages/file-download?path=org-1/channel-1/profile-1/file.pdf`,
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://signed.example.com/file.pdf');
  });

  it('returns 403 when the user is not a member of the channel in the file path', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null });

    const response = await GET(
      new Request(
        `${APP_URL}/api/messages/file-download?path=org-1/channel-1/profile-1/file.pdf`,
      ),
    );

    expect(response.status).toBe(403);
  });
});
