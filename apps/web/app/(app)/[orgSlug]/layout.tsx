import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SidebarProvider } from '@iconicedu/ui-web';
import { cookies } from 'next/headers';

import { SidebarShell } from '@iconicedu/web/app/(app)/[orgSlug]/sidebar-shell';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { buildAdminMenuSections } from '@iconicedu/web/lib/data/admin-menu-sections';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { loadSidebarContext } from '@iconicedu/web/lib/sidebar/loadSidebarContext';
import { buildSidebarBaseData } from '@iconicedu/web/lib/sidebar/buildSidebarBaseData';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard | ICONIC Academy',
    template: '%s | ICONIC Academy Dashboard',
  },
  description: 'ICONIC Academy learner dashboard for classes, messages, and progress tracking.',
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

  if (!account.primary_role || !account.onboarding_completed_at || account.role_status === 'unassigned') {
    redirect('/auth/callback?resume=1');
  }

  if (account.role_status === 'pending' || account.role_status === 'blocked') {
    redirect('/login/pending-access');
  }

  const cookieStore = await cookies();
  const overrideCookie = cookieStore.get('profile_kind_override');
  const profileKindOverrideFromCookie =
    overrideCookie?.value === 'educator' ? 'educator' : undefined;
  const profileKindOverride = profileKindOverrideFromCookie;

  const baseSidebarData = await buildSidebarBaseData(
    supabase,
    account.org_id,
    account.id,
    `/${orgSlug}`,
  );
  const { sidebarData, onboardingStatus } = await loadSidebarContext(supabase, {
    authUser,
    account,
    familyInvite: invite,
    baseSidebarData,
    profileKindOverride,
  });

  return (
    <SidebarProvider>
      <SidebarShell
        data={sidebarData}
        initialOnboardingStatus={onboardingStatus}
        adminSections={buildAdminMenuSections(`/${orgSlug}`)}
      >
        {children}
      </SidebarShell>
    </SidebarProvider>
  );
}
