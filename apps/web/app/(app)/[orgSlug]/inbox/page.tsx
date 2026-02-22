import { DashboardHeader, InboxContainer } from '@iconicedu/ui-web';

import { buildActivityFeedByOrg } from '@iconicedu/web/lib/activity-feed/builders/activity-feed.builder';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const feed = await buildActivityFeedByOrg(supabase, account.org_id);

  return (
    <div className="flex min-h-0 h-screen flex-1 flex-col">
      <DashboardHeader title={'Inbox'} />
      <div className="p-4 pt-0">
        <InboxContainer feed={feed} />
      </div>
    </div>
  );
}
