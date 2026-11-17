import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './page';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));
vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: vi.fn(),
}));
vi.mock('@iconicedu/web/lib/admin/require-admin-org-context', () => ({
  requireAdminOrgContext: vi.fn(),
}));
vi.mock('./org-general-settings-dashboard', () => ({
  OrgGeneralSettingsDashboard: ({ orgId }: { orgId: string }) => (
    <div data-testid="settings-dashboard">{orgId}</div>
  ),
}));
vi.mock('@iconicedu/web/components/admin/admin-page-layout', () => ({
  AdminPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminPageHeading: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

type AdminContext = Awaited<ReturnType<typeof requireAdminOrgContext>>;

describe('organization general settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildOrgBySlug).mockResolvedValue({ id: 'org-1' } as Awaited<
      ReturnType<typeof buildOrgBySlug>
    >);
  });

  it('renders the AI provider settings for admins', async () => {
    vi.mocked(requireAdminOrgContext).mockResolvedValue({
      ok: true,
      actorProfileId: 'admin-1',
    } as AdminContext);

    render(await Page({ params: Promise.resolve({ orgSlug: 'iconic-academy' }) }));

    expect(screen.getByTestId('settings-dashboard')).toHaveTextContent('org-1');
    expect(requireAdminOrgContext).toHaveBeenCalledWith('org-1');
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('returns notFound for non-admins', async () => {
    vi.mocked(requireAdminOrgContext).mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Forbidden',
    } as AdminContext);

    await expect(
      Page({ params: Promise.resolve({ orgSlug: 'iconic-academy' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('returns notFound for an unknown organization', async () => {
    vi.mocked(buildOrgBySlug).mockResolvedValue(null);

    await expect(
      Page({ params: Promise.resolve({ orgSlug: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(requireAdminOrgContext).not.toHaveBeenCalled();
  });
});
