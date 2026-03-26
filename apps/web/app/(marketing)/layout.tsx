import type { ReactNode } from 'react';
import Script from 'next/script';
import { MarketingHeader } from '@iconicedu/ui-web';
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
      <Script
        id="crisp-chat"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.$crisp = [];
            window.CRISP_WEBSITE_ID = "be84755a-d173-44c3-b99d-2f3027387dd4";
            (function () {
              var d = document;
              var s = d.createElement("script");
              s.src = "https://client.crisp.chat/l.js";
              s.async = 1;
              d.getElementsByTagName("head")[0].appendChild(s);
            })();
          `,
        }}
      />
      <MarketingHeader
        isAuthenticated={Boolean(user)}
        loginHref={loginHref}
        dashboardHref={dashboardHref}
      />
      <main>{children}</main>
    </>
  );
}
