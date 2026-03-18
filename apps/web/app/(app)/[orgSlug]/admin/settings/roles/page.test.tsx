import { describe, expect, it, vi } from 'vitest';

import Page from '@iconicedu/web/app/(app)/[orgSlug]/admin/settings/roles/page';

const createSupabaseServerClientMock = vi.fn();
const buildOrgBySlugMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error('not-found');
});

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlugMock(...args),
}));

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

describe('admin settings roles page', () => {
  it('renders the roles dashboard with org id', async () => {
    createSupabaseServerClientMock.mockResolvedValue({});
    buildOrgBySlugMock.mockResolvedValue({ id: 'org-1', slug: 'iconic-academy' });

    const element = await Page({
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    const children = (element as { props?: { children?: unknown[] } }).props
      ?.children as unknown[];
    const contentContainer = children?.[1] as
      | { props?: { children?: unknown } }
      | undefined;
    const dashboardElement = contentContainer?.props?.children as
      | { props?: { orgId?: string } }
      | undefined;
    expect(dashboardElement?.props?.orgId).toBe('org-1');
  });

  it('calls notFound when org cannot be resolved', async () => {
    createSupabaseServerClientMock.mockResolvedValue({});
    buildOrgBySlugMock.mockResolvedValue(null);

    await expect(
      Page({
        params: Promise.resolve({ orgSlug: 'missing-org' }),
      }),
    ).rejects.toThrow('not-found');
  });
});
