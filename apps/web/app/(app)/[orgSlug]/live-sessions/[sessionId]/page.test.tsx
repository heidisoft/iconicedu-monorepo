import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@iconicedu/ui-web', () => ({ DashboardHeader: () => null }));
vi.mock('@iconicedu/web/components/live-sessions/live-session-host', () => ({
  LiveSessionHost: () => null,
}));
vi.mock('@iconicedu/web/lib/api/http-client', () => ({
  createApiClient: () => ({ post: mocks.post }),
}));
vi.mock('@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth', () => ({
  getDashboardAccountContext: async () => ({
    supabase: {},
    account: { id: 'account', org_id: 'org' },
  }),
  getDashboardProfileContext: async () => ({
    profileResponse: { data: { id: 'profile' } },
  }),
}));
import Page from './page';
beforeEach(() => vi.clearAllMocks());
describe('legacy Zoom URLs', () => {
  it('redirects to shared preview/admission and retains the classroom return path', async () => {
    mocks.post.mockResolvedValue({
      provider: 'zoom',
      joinPath: '/live/aaaa-bbbb-cccc',
      returnPath: '/academy/s/class',
    });
    await expect(
      Page({ params: Promise.resolve({ orgSlug: 'academy', sessionId: 'session' }) }),
    ).rejects.toThrow('/live/aaaa-bbbb-cccc?returnTo=%2Facademy%2Fs%2Fclass');
    expect(mocks.post).toHaveBeenCalledWith('/live-sessions/session/member-access', {
      orgId: 'org',
      profileId: 'profile',
    });
  });
});
