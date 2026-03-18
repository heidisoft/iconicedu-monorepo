/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';

const createSupabaseServerClientMock = vi.fn(async () => ({ client: 'supabase' }));
const requireAuthedUserMock = vi.fn(async () => ({
  id: 'auth-user-1',
  email: 'user@example.com',
}));
const getOrCreateAccountMock = vi.fn(async () => ({
  account: { id: 'account-1', org_id: 'org-1' },
}));
const resolveOrgDashboardPathMock = vi.fn(async () => '/iconic-academy');
const buildOrgBySlugMock = vi.fn(async () => ({ id: 'org-1' }));
const getProfileByAccountIdMock = vi.fn(async () => ({ data: { id: 'profile-active' } }));
const buildUserProfileByIdMock = vi.fn(async () => ({ ids: { id: 'profile-active' } }));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: (...args: unknown[]) => requireAuthedUserMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: (...args: unknown[]) => getOrCreateAccountMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: (...args: unknown[]) => resolveOrgDashboardPathMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlugMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/queries/profiles.query', () => ({
  getProfileByAccountId: (...args: unknown[]) => getProfileByAccountIdMock(...args),
}));

vi.mock('@iconicedu/web/lib/profile/builders/user-profile.builder', () => ({
  buildUserProfileById: (...args: unknown[]) => buildUserProfileByIdMock(...args),
}));

describe('dashboard-auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds account context once with dashboard path', async () => {
    const result = await getDashboardAccountContext('iconic-academy');

    expect(requireAuthedUserMock).toHaveBeenCalledTimes(1);
    expect(buildOrgBySlugMock).toHaveBeenCalledWith(
      { client: 'supabase' },
      'iconic-academy',
    );
    expect(getOrCreateAccountMock).toHaveBeenCalledTimes(1);
    expect(resolveOrgDashboardPathMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      supabase: { client: 'supabase' },
      authUser: { id: 'auth-user-1', email: 'user@example.com' },
      account: { id: 'account-1', org_id: 'org-1' },
      dashboardPath: '/iconic-academy',
    });
  });

  it('builds profile context from the resolved active account profile', async () => {
    const supabase = { client: 'supabase' } as any;
    const result = await getDashboardProfileContext(supabase, 'account-1');

    expect(getProfileByAccountIdMock).toHaveBeenCalledWith(supabase, 'account-1');
    expect(buildUserProfileByIdMock).toHaveBeenCalledWith(supabase, 'profile-active');
    expect(result).toEqual({
      profileResponse: { data: { id: 'profile-active' } },
      currentUserProfile: { ids: { id: 'profile-active' } },
    });
  });
});
