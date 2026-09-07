import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@iconicedu/web/app/api/admin/spaces/list/route';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

const createSupabaseServerClient = vi.fn();
const buildOrgBySlug = vi.fn();
const requireAdminOrgContext = vi.fn();
const getAdminLearningSpaceRows = vi.fn();
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

vi.mock('@iconicedu/web/lib/admin/learning-spaces', () => ({
  getAdminLearningSpaceRows: (...args: unknown[]) => getAdminLearningSpaceRows(...args),
}));

describe('GET /api/admin/spaces/list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClient.mockResolvedValue({ id: 'supabase-client' });
    buildOrgBySlug.mockResolvedValue({ id: 'org-1', slug: 'acme' });
    requireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-1',
    });
    getAdminLearningSpaceRows.mockResolvedValue([]);
  });

  it('rejects non-admin users before loading learning space rows', async () => {
    requireAdminOrgContext.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });

    const response = await GET(
      new Request(`${APP_URL}/api/admin/spaces/list?orgSlug=acme`),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Forbidden',
    });
    expect(getAdminLearningSpaceRows).not.toHaveBeenCalled();
  });

  it('matches the free-text search against participant names', async () => {
    getAdminLearningSpaceRows.mockResolvedValueOnce([
      {
        id: 'space-1',
        title: 'Algebra I',
        status: 'active',
        subject: 'Math',
        description: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-02T00:00:00.000Z',
        participantNames: ['Ari Stone'],
        participantDetails: [
          { id: 'profile-1', displayName: 'Ari Stone', kind: 'child' },
        ],
      },
      {
        id: 'space-2',
        title: 'Creative Writing',
        status: 'active',
        subject: 'English',
        description: null,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-03T00:00:00.000Z',
        participantNames: ['Maya Chen'],
        participantDetails: [
          { id: 'profile-2', displayName: 'Maya Chen', kind: 'child' },
        ],
      },
    ]);

    const response = await GET(
      new Request(`${APP_URL}/api/admin/spaces/list?orgSlug=acme&search=maya`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      total: 1,
      rows: [{ id: 'space-2', title: 'Creative Writing' }],
    });
  });
});
