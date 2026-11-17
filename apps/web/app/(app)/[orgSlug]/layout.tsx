import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SidebarProvider } from '@iconicedu/ui-web';

import { SidebarShell } from '@iconicedu/web/app/(app)/[orgSlug]/sidebar-shell';
import { buildAdminMenuSections } from '@iconicedu/web/lib/data/admin-menu-sections';
import {
  getDashboardAccountContext,
  getDashboardFamilyViewResolution,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { loadSidebarContext } from '@iconicedu/web/lib/sidebar/loadSidebarContext';
import { buildSidebarBaseData } from '@iconicedu/web/lib/sidebar/buildSidebarBaseData';
import {
  shouldRedirectToAuthResume,
  WEB_INCOMPLETE_ONBOARDING_LOGIN_REASON,
  WEB_INCOMPLETE_ONBOARDING_REAUTH_COOKIE,
} from '@iconicedu/web/app/(app)/[orgSlug]/layout-auth-gate';
import {
  listActiveOrgSubjectCatalog,
  mapOrgSubjectRowsToOptions,
} from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';
import { enableAssessments } from '@iconicedu/web/flags';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard | ICONIC Academy',
    template: '%s | ICONIC Academy Dashboard',
  },
  description:
    'ICONIC Academy learner dashboard for classes, messages, and progress tracking.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const cookieStore = await cookies();
  const { supabase, authUser, account, invite } =
    await getDashboardAccountContext(orgSlug);

  if (
    shouldRedirectToAuthResume({
      account,
      reauthCookieValue:
        cookieStore.get(WEB_INCOMPLETE_ONBOARDING_REAUTH_COOKIE)?.value ?? null,
    })
  ) {
    redirect(`/${orgSlug}/login?reason=${WEB_INCOMPLETE_ONBOARDING_LOGIN_REASON}`);
  }

  if (account.role_status === 'pending' || account.role_status === 'blocked') {
    redirect(`/${orgSlug}/login/pending-access`);
  }

  const familyViewResolution = await getDashboardFamilyViewResolution(
    supabase,
    account.id,
  );
  if (!familyViewResolution) {
    redirect(`/${orgSlug}/login`);
  }

  const baseSidebarData = await buildSidebarBaseData(
    supabase,
    account.org_id,
    familyViewResolution.effectiveProfile.account_id,
    `/${orgSlug}`,
  );
  const { sidebarData, onboardingStatus } = await loadSidebarContext(supabase, {
    authUser,
    account,
    familyInvite: invite,
    baseSidebarData,
    effectiveProfileRow: familyViewResolution.effectiveProfile,
    familySwitchOptions: familyViewResolution.familySwitchOptions.map((option) => ({
      ...option,
      isActive: option.profileId === familyViewResolution.effectiveProfile.id,
    })),
    isViewingAsChild: familyViewResolution.isViewingAsChild,
    viewingAsProfileId: familyViewResolution.viewingAsProfileId,
  });
  const subjectCatalogResponse = await listActiveOrgSubjectCatalog(
    supabase,
    account.org_id,
  );
  const subjectOptions = mapOrgSubjectRowsToOptions(subjectCatalogResponse.data);
  const assessmentsEnabled = await enableAssessments.run({
    identify: { profileId: familyViewResolution.effectiveProfile.id },
  });
  const includeReports = false;

  return (
    <SidebarProvider>
      <SidebarShell
        data={sidebarData}
        initialOnboardingStatus={onboardingStatus}
        isPersonaSwitchEnabled
        isPersonaAddEnabled
        adminSections={buildAdminMenuSections(`/${orgSlug}`, {
          includeReports,
          includeAssessments: assessmentsEnabled,
        })}
        subjectOptions={subjectOptions}
      >
        {children}
      </SidebarShell>
    </SidebarProvider>
  );
}
