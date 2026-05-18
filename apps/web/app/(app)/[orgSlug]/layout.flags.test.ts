import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  sidebarShellMock,
  createSupabaseServerClientMock,
  requireAuthedUserMock,
  cookiesMock,
  buildOrgBySlugMock,
  getOrCreateAccountMock,
  buildSidebarBaseDataMock,
  loadSidebarContextMock,
  resolveEffectiveProfileForAccountInOrgMock,
  listActiveOrgSubjectCatalogMock,
  mapOrgSubjectRowsToOptionsMock,
  buildAdminMenuSectionsMock,
  enableAdminActivityFeedAuditRunMock,
  enableAdminReportsRunMock,
  shouldRedirectToAuthResumeMock,
  resolveOrgDashboardPathMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  sidebarShellMock: vi.fn(() => null),
  createSupabaseServerClientMock: vi.fn(),
  requireAuthedUserMock: vi.fn(),
  cookiesMock: vi.fn(),
  buildOrgBySlugMock: vi.fn(),
  getOrCreateAccountMock: vi.fn(),
  buildSidebarBaseDataMock: vi.fn(),
  loadSidebarContextMock: vi.fn(),
  resolveEffectiveProfileForAccountInOrgMock: vi.fn(),
  listActiveOrgSubjectCatalogMock: vi.fn(),
  mapOrgSubjectRowsToOptionsMock: vi.fn(),
  buildAdminMenuSectionsMock: vi.fn(),
  enableAdminActivityFeedAuditRunMock: vi.fn(),
  enableAdminReportsRunMock: vi.fn(),
  shouldRedirectToAuthResumeMock: vi.fn(),
  resolveOrgDashboardPathMock: vi.fn(),
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
}));

vi.mock('@iconicedu/ui-web', () => ({
  SidebarProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/sidebar-shell', () => ({
  SidebarShell: (props: unknown) => sidebarShellMock(props),
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/auth/requireAuthedUser', () => ({
  requireAuthedUser: (...args: unknown[]) => requireAuthedUserMock(...args),
}));

vi.mock('next/headers', () => ({
  cookies: (...args: unknown[]) => cookiesMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/builders/org.builder', () => ({
  buildOrgBySlug: (...args: unknown[]) => buildOrgBySlugMock(...args),
}));

vi.mock('@iconicedu/web/lib/accounts/getOrCreateAccount', () => ({
  getOrCreateAccount: (...args: unknown[]) => getOrCreateAccountMock(...args),
}));

vi.mock('@iconicedu/web/lib/sidebar/buildSidebarBaseData', () => ({
  buildSidebarBaseData: (...args: unknown[]) => buildSidebarBaseDataMock(...args),
}));

vi.mock('@iconicedu/web/lib/sidebar/loadSidebarContext', () => ({
  loadSidebarContext: (...args: unknown[]) => loadSidebarContextMock(...args),
}));

vi.mock('@iconicedu/web/lib/family-view/effective-profile', () => ({
  resolveEffectiveProfileForAccountInOrg: (...args: unknown[]) =>
    resolveEffectiveProfileForAccountInOrgMock(...args),
}));

vi.mock('@iconicedu/web/lib/subjects/queries/org-subject-catalog.query', () => ({
  listActiveOrgSubjectCatalog: (...args: unknown[]) =>
    listActiveOrgSubjectCatalogMock(...args),
  mapOrgSubjectRowsToOptions: (...args: unknown[]) =>
    mapOrgSubjectRowsToOptionsMock(...args),
}));

vi.mock('@iconicedu/web/lib/data/admin-menu-sections', () => ({
  buildAdminMenuSections: (...args: unknown[]) => buildAdminMenuSectionsMock(...args),
}));

vi.mock('@iconicedu/web/flags', () => ({
  enableAdminActivityFeedAudit: {
    run: (...args: unknown[]) => enableAdminActivityFeedAuditRunMock(...args),
  },
  enableAdminReports: {
    run: (...args: unknown[]) => enableAdminReportsRunMock(...args),
  },
}));

vi.mock('@iconicedu/web/app/(app)/[orgSlug]/layout-auth-gate', () => ({
  shouldRedirectToAuthResume: (...args: unknown[]) =>
    shouldRedirectToAuthResumeMock(...args),
  WEB_INCOMPLETE_ONBOARDING_LOGIN_REASON: 'incomplete-onboarding',
  WEB_INCOMPLETE_ONBOARDING_REAUTH_COOKIE: 'iconicedu-incomplete-onboarding-reauth',
}));

vi.mock('@iconicedu/web/lib/org/resolve-dashboard-path', () => ({
  resolveOrgDashboardPath: (...args: unknown[]) => resolveOrgDashboardPathMock(...args),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
  notFound: (...args: unknown[]) => notFoundMock(...args),
}));

import Layout from '@iconicedu/web/app/(app)/[orgSlug]/layout';

describe('org layout persona flags', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.DEBUG_POSTHOG_FLAGS;

    sidebarShellMock.mockReset();
    createSupabaseServerClientMock.mockReset();
    requireAuthedUserMock.mockReset();
    cookiesMock.mockReset();
    buildOrgBySlugMock.mockReset();
    getOrCreateAccountMock.mockReset();
    buildSidebarBaseDataMock.mockReset();
    loadSidebarContextMock.mockReset();
    resolveEffectiveProfileForAccountInOrgMock.mockReset();
    listActiveOrgSubjectCatalogMock.mockReset();
    mapOrgSubjectRowsToOptionsMock.mockReset();
    buildAdminMenuSectionsMock.mockReset();
    enableAdminActivityFeedAuditRunMock.mockReset();
    enableAdminReportsRunMock.mockReset();
    shouldRedirectToAuthResumeMock.mockReset();
    resolveOrgDashboardPathMock.mockReset();
    redirectMock.mockReset();
    notFoundMock.mockReset();

    createSupabaseServerClientMock.mockResolvedValue({} as never);
    requireAuthedUserMock.mockResolvedValue({ id: 'auth-1', email: 'parent@test.com' });
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });
    buildOrgBySlugMock.mockResolvedValue({ id: 'org-1', slug: 'iconic-academy' });
    getOrCreateAccountMock.mockResolvedValue({
      account: {
        id: 'account-1',
        org_id: 'org-1',
        role_status: 'active',
      },
      invite: null,
    });
    shouldRedirectToAuthResumeMock.mockReturnValue(false);
    resolveEffectiveProfileForAccountInOrgMock.mockResolvedValue({
      effectiveProfile: { id: 'profile-1', account_id: 'account-1', org_id: 'org-1' },
      familySwitchOptions: [],
      isViewingAsChild: false,
      viewingAsProfileId: null,
    });
    buildSidebarBaseDataMock.mockResolvedValue({
      navigation: {},
      collections: { directMessages: [] },
    });
    loadSidebarContextMock.mockResolvedValue({
      sidebarData: {
        user: {
          profile: { ids: { id: 'profile-1', orgId: 'org-1' } },
        },
      },
      onboardingStatus: null,
    });
    listActiveOrgSubjectCatalogMock.mockResolvedValue({ data: [], error: null });
    mapOrgSubjectRowsToOptionsMock.mockReturnValue([]);
    buildAdminMenuSectionsMock.mockReturnValue([]);
    enableAdminActivityFeedAuditRunMock.mockResolvedValue(false);
    enableAdminReportsRunMock.mockResolvedValue(false);
    resolveOrgDashboardPathMock.mockResolvedValue('/iconic-academy');
  });

  it('passes persona availability into SidebarShell as enabled by default', async () => {
    const element = await Layout({
      children: null,
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });

    const sidebarShellElement = (element as { props?: { children?: unknown } }).props
      ?.children as { props?: Record<string, unknown> } | undefined;
    expect(sidebarShellElement?.props?.isPersonaSwitchEnabled).toBe(true);
    expect(sidebarShellElement?.props?.isPersonaAddEnabled).toBe(true);
    expect(buildAdminMenuSectionsMock).toHaveBeenCalledWith('/iconic-academy', {
      includeActivityFeedAudit: false,
      includeReports: true,
    });
  });

  it('does not emit layout debug logs', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await Layout({
      children: null,
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('does not emit layout debug logs when posthog flag debugging is enabled', async () => {
    process.env.DEBUG_POSTHOG_FLAGS = 'true';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await Layout({
      children: null,
      params: Promise.resolve({ orgSlug: 'iconic-academy' }),
    });

    expect(infoSpy).not.toHaveBeenCalled();
  });
});
