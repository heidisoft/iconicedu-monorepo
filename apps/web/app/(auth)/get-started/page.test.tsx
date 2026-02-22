import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from '@iconicedu/web/app/(auth)/get-started/page';

const redirectMock = vi.fn();
const resolveOrgDashboardPathMock = vi.fn(async () => '/iconic-academy');
const getDefaultOrgMock = vi.fn();
const getAccountByAuthUserIdMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: (...args: unknown[]) => resolveOrgDashboardPathMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/queries/org.query', () => ({
  getDefaultOrg: (...args: unknown[]) => getDefaultOrgMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/queries/accounts.query', () => ({
  getAccountByAuthUserId: (...args: unknown[]) => getAccountByAuthUserIdMock(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/service', () => ({
  createSupabaseServiceClient: vi.fn(() => ({})),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  })),
}));

vi.mock('@iconicedu/web/app/(auth)/get-started/get-started-client', () => ({
  default: () => null,
}));

vi.mock('@iconicedu/web/app/(auth)/get-started/get-started-auth-client', () => ({
  default: () => null,
}));

describe('global get-started page', () => {
  beforeEach(() => {
    redirectMock.mockReset();
    resolveOrgDashboardPathMock.mockReset();
    getDefaultOrgMock.mockReset();
    getAccountByAuthUserIdMock.mockReset();
    getUserMock.mockReset();
    resolveOrgDashboardPathMock.mockResolvedValue('/iconic-academy');
    getDefaultOrgMock.mockResolvedValue({ data: null, error: null });
  });

  it('redirects to default org path when orgs already exist', async () => {
    getDefaultOrgMock.mockResolvedValueOnce({
      data: { id: 'org-1', slug: 'iconic-academy' },
      error: null,
    });

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/iconic-academy');
  });

  it('redirects users with org account to org login', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'auth-user-1' } } });
    getAccountByAuthUserIdMock.mockResolvedValueOnce({
      data: { id: 'account-1', org_id: 'org-2' },
      error: null,
    });
    resolveOrgDashboardPathMock.mockResolvedValueOnce('/acme-org');

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/acme-org/login');
  });

  it('renders auth form when orgs are empty and user is anonymous', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    const element = await Page();
    expect(element).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('renders create organization form for users without org account', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'auth-user-1' } } });
    getAccountByAuthUserIdMock.mockResolvedValueOnce({ data: null, error: null });

    const element = await Page();
    expect(element).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
