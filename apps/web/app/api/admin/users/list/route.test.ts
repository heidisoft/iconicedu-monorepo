import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/admin/users/list/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const createSupabaseServerClient = vi.fn();
const buildOrgBySlug = vi.fn();
const requireAdminOrgContext = vi.fn();
const getAdminUserRowsPaginated = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlug(...args),
}));

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', async () => {
  const actual = await vi.importActual<
    typeof import('@iconicedu/web/lib/admin/require-admin-org-context')
  >('@iconicedu/web/lib/admin/require-admin-org-context');

  return {
    ...actual,
    requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContext(...args),
  };
});

vi.mock('@iconicedu/web/lib/admin/users', () => ({
  getAdminUserRowsPaginated: (...args: unknown[]) => getAdminUserRowsPaginated(...args),
}));

describe('GET /api/admin/users/list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClient.mockResolvedValue({ id: 'supabase-client' });
    buildOrgBySlug.mockResolvedValue({ id: 'org-1', slug: 'acme' });
    requireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-1',
    });
    getAdminUserRowsPaginated.mockResolvedValue({
      rows: [],
      total: 0,
      pageCount: 1,
    });
  });

  it('rejects non-admin users before loading user rows', async () => {
    requireAdminOrgContext.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'Switch back to Parent to perform this action.',
    });

    const response = await GET(
      new Request(`${APP_URL}/api/admin/users/list?orgSlug=acme`),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Switch back to Parent to perform this action.',
    });
    expect(getAdminUserRowsPaginated).not.toHaveBeenCalled();
  });
});
