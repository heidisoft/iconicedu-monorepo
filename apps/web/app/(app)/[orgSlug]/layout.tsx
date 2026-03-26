import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SidebarProvider } from '@iconicedu/ui-web';

import { SidebarShell } from '@iconicedu/web/app/(app)/[orgSlug]/sidebar-shell';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { buildAdminMenuSections } from '@iconicedu/web/lib/data/admin-menu-sections';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { loadSidebarContext } from '@iconicedu/web/lib/sidebar/loadSidebarContext';
import { buildSidebarBaseData } from '@iconicedu/web/lib/sidebar/buildSidebarBaseData';
import { resolveEffectiveProfileForAccountInOrg } from '@iconicedu/web/lib/family-view/effective-profile';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { shouldRedirectToAuthResume } from '@iconicedu/web/app/(app)/[orgSlug]/layout-auth-gate';
import {
  listActiveOrgSubjectCatalog,
  mapOrgSubjectRowsToOptions,
} from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';

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
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);
  const requestedOrg = await buildOrgBySlug(supabase, orgSlug);

  if (!requestedOrg) {
    notFound();
  }

  const { account, invite } = await getOrCreateAccount(supabase, {
    orgId: requestedOrg.id,
    authUserId: authUser.id,
    authEmail: authUser.email ?? null,
  });

  if (account.org_id !== requestedOrg.id) {
    const destination = await resolveOrgDashboardPath(supabase, account.org_id);
    redirect(destination);
  }

  if (shouldRedirectToAuthResume(account)) {
    redirect('/auth/callback?resume=1');
  }

  if (account.role_status === 'pending' || account.role_status === 'blocked') {
    redirect(`/${orgSlug}/login/pending-access`);
  }

  const familyViewResolution = await resolveEffectiveProfileForAccountInOrg(supabase, {
    account,
    authUserId: authUser.id,
  });

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

  return (
    <SidebarProvider>
      <SidebarShell
        data={sidebarData}
        initialOnboardingStatus={onboardingStatus}
        isPersonaSwitchEnabled
        isPersonaAddEnabled
        adminSections={buildAdminMenuSections(`/${orgSlug}`)}
        subjectOptions={subjectOptions}
      >
        {children}
      </SidebarShell>
    </SidebarProvider>
  );
}
