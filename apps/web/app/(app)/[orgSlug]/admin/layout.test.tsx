import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClient = vi.fn();
const buildOrgBySlug = vi.fn();
const requireAdminOrgContext = vi.fn();
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const redirect = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock('next/navigation', () => ({
  notFound: (...args: unknown[]) => notFound(...args),
  redirect: (...args: [string]) => redirect(...args),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlug(...args),
}));

vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: (...args: unknown[]) => requireAdminOrgContext(...args),
}));

import AdminLayout from '@iconicedu/web/app/(app)/[orgSlug]/admin/layout';

describe('admin layout access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClient.mockResolvedValue({ id: 'supabase-client' });
    buildOrgBySlug.mockResolvedValue({ id: 'org-1', slug: 'acme' });
    requireAdminOrgContext.mockResolvedValue({
      ok: true,
      orgId: 'org-1',
      actorProfileId: 'profile-1',
    });
  });

  it('renders admin routes for owner, admin, or staff authorized users', async () => {
    await expect(
      AdminLayout({
        children: 'admin content',
        params: Promise.resolve({ orgSlug: 'acme' }),
      }),
    ).resolves.toBe('admin content');

    expect(buildOrgBySlug).toHaveBeenCalledWith({ id: 'supabase-client' }, 'acme');
    expect(requireAdminOrgContext).toHaveBeenCalledWith('org-1');
  });

  it('redirects non-admin users away from admin routes', async () => {
    requireAdminOrgContext.mockResolvedValueOnce({
      ok: false,
      status: 403,
      message: 'Forbidden',
    });

    await expect(
      AdminLayout({
        children: 'admin content',
        params: Promise.resolve({ orgSlug: 'acme' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/acme');

    expect(redirect).toHaveBeenCalledWith('/acme');
  });

  it('returns not found when the org slug does not exist', async () => {
    buildOrgBySlug.mockResolvedValueOnce(null);

    await expect(
      AdminLayout({
        children: 'admin content',
        params: Promise.resolve({ orgSlug: 'missing' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
    expect(requireAdminOrgContext).not.toHaveBeenCalled();
  });
});
