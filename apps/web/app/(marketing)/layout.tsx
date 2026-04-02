import type { ReactNode } from 'react';
import { MarketingHeader } from '@iconicedu/ui-web';
import { ChatWidgetScript } from '@iconicedu/web/components/chat-widget-script';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { resolveDefaultOrgLoginPath } from '@iconicedu/web/lib/org/resolve-auth-path';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export { metadata } from './layout.metadata';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const loginHref = await resolveDefaultOrgLoginPath(supabase);
  let dashboardHref = '/get-started';

  if (user?.id) {
    const accountResponse = await getAccountByAuthUserId(supabase, user.id);
    if (accountResponse.data?.org_id) {
      dashboardHref = await resolveOrgDashboardPath(
        supabase,
        accountResponse.data.org_id,
      );
    }
  }

  return (
    <>
      <ChatWidgetScript />
      <MarketingHeader
        isAuthenticated={Boolean(user)}
        loginHref={loginHref}
        dashboardHref={dashboardHref}
      />
      <main>{children}</main>
    </>
  );
}
