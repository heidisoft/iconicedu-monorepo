import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/admin/channels/list/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const createSupabaseServerClient = vi.fn();
const buildOrgBySlug = vi.fn();
const requireAdminOrgContext = vi.fn();
const getAdminChannelRows = vi.fn();
const APP_URL = resolveAppUrl();

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlug(...args),
}));

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContext(...args),
}));

vi.mock('@iconicedu/web/lib/admin/channels', () => ({
  getAdminChannelRows: (...args: unknown[]) => getAdminChannelRows(...args),
}));

describe('GET /api/admin/channels/list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClient.mockResolvedValue({ id: 'supabase-client' });
    buildOrgBySlug.mockResolvedValue({ id: 'org-1', slug: 'acme' });
    requireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-1',
    });
    getAdminChannelRows.mockResolvedValue([]);
  });

  it('rejects non-admin users before loading channel rows', async () => {
    requireAdminOrgContext.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });

    const response = await GET(
      new Request(`${APP_URL}/api/admin/channels/list?orgSlug=acme`),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Forbidden',
    });
    expect(getAdminChannelRows).not.toHaveBeenCalled();
  });
});
