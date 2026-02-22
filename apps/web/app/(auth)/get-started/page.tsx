import { redirect } from 'next/navigation';

import GetStartedClient from '@iconicedu/web/app/(auth)/get-started/get-started-client';
import GetStartedAuthClient from '@iconicedu/web/app/(auth)/get-started/get-started-auth-client';
import { getAccountByAuthUserId } from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { getDefaultOrg } from '@iconicedu/web/lib/org/queries/org.query';
import { resolveOrgDashboardPath } from '@iconicedu/web/lib/org/resolve-dashboard-path';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

async function resolveOrgLoginPath(orgId: string): Promise<string> {
  const serviceSupabase = createSupabaseServiceClient();
  const dashboardPath = await resolveOrgDashboardPath(serviceSupabase, orgId);
  if (dashboardPath === '/get-started') {
    return '/iconic-academy/login';
  }
  return `${dashboardPath}/login`;
}

export default async function GetStartedPage() {
  const serviceSupabase = createSupabaseServiceClient();
  const defaultOrgResponse = await getDefaultOrg(serviceSupabase);
  if (defaultOrgResponse.error) {
    throw defaultOrgResponse.error;
  }
  if (defaultOrgResponse.data?.slug) {
    redirect(`/${defaultOrgResponse.data.slug}`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <GetStartedAuthClient />
        </div>
      </div>
    );
  }

  const accountResponse = await getAccountByAuthUserId(serviceSupabase, user.id);
  if (accountResponse.error) {
    throw accountResponse.error;
  }

  if (accountResponse.data?.org_id) {
    redirect(await resolveOrgLoginPath(accountResponse.data.org_id));
  }

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <GetStartedClient />
    </div>
  );
}
