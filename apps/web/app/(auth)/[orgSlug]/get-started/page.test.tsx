import { describe, expect, it, vi } from 'vitest';

import Page from './page';

const redirectMock = vi.fn();
const notFoundMock = vi.fn();
const buildOrgBySlugMock = vi.fn();
const getAccountByAuthUserIdInOrgMock = vi.fn();
const resolveOrgDashboardPathMock = vi.fn(async () => '/iconic-academy');
const getUserMock = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    notFoundMock();
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlugMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserIdInOrg: (...args: unknown[]) =>
    getAccountByAuthUserIdInOrgMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: (...args: unknown[]) => resolveOrgDashboardPathMock(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  })),
}));

vi.mock('@iconicedu/web/app/(auth)/[orgSlug]/get-started/org-get-started-client', () => ({
  default: () => null,
}));

describe('org get-started page', () => {
  it('redirects authenticated users without org account to global get-started', async () => {
    buildOrgBySlugMock.mockResolvedValueOnce({
      id: 'org-1',
      slug: 'iconic-academy',
      name: 'ICONIC',
    });
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    getAccountByAuthUserIdInOrgMock.mockResolvedValueOnce({ data: null });

    await expect(
      Page({ params: Promise.resolve({ orgSlug: 'iconic-academy' }) }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(
      '/auth/callback?resume=1&org=iconic-academy&intent=get-started&source=self-signup',
    );
  });
});
