import type { ReactNode } from 'react';
import { SidebarProvider } from '@iconicedu/ui-web';
import { cookies, headers } from 'next/headers';

import { SidebarShell } from '@iconicedu/web/app/(app)/d/sidebar-shell';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { ORG_ID } from '@iconicedu/web/lib/data/ids';
import { ADMIN_MENU_SECTIONS } from '@iconicedu/web/lib/data/admin-menu-sections';
import { requireAuthedUser } from '@iconicedu/web/lib/auth/requireAuthedUser';
import { getOrCreateAccount } from '@iconicedu/web/lib/accounts/getOrCreateAccount';
import { loadSidebarContext } from '@iconicedu/web/lib/sidebar/loadSidebarContext';
import { buildSidebarBaseData } from '@iconicedu/web/lib/sidebar/buildSidebarBaseData';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

export default async function Layout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const authUser = await requireAuthedUser(supabase);

  const { account, invite } = await getOrCreateAccount(supabase, {
    orgId: ORG_ID,
    authUserId: authUser.id,
    authEmail: authUser.email ?? null,
  });

  const headerStore = await headers();
  const referer = headerStore.get('referer');
  const cookieStore = await cookies();
  const overrideCookie = cookieStore.get('profile_kind_override');
  const profileKindOverrideFromCookie =
    overrideCookie?.value === 'educator' ? 'educator' : undefined;
  const profileKindOverrideFromReferer =
    referer?.includes('/login/tutor') &&
    new URL(referer, resolveAppUrl()).searchParams.get('educator') === '1'
      ? 'educator'
      : undefined;
  const profileKindOverride = profileKindOverrideFromCookie ?? profileKindOverrideFromReferer;

  const baseSidebarData = await buildSidebarBaseData(
    supabase,
    account.org_id,
    account.id,
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
        adminSections={ADMIN_MENU_SECTIONS}
      >
        {children}
      </SidebarShell>
    </SidebarProvider>
  );
}
