import { DashboardHeader, InboxContainer } from '@iconicedu/ui-web';

import { buildActivityFeedForProfile } from '@iconicedu/web/lib/activity-feed/builders/activity-feed.builder';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
// import { INBOX_ACTIVITY_FEED } from '@iconicedu/web/lib/data/inbox-activities';

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { profileResponse } = await getDashboardProfileContext(supabase, account.id);
  const feed = await buildActivityFeedForProfile(
    supabase,
    account.org_id,
    profileResponse.data?.id ?? '',
  );

  return (
    <div className="flex min-h-0 h-screen flex-1 flex-col">
      <DashboardHeader title={'Inbox'} />
      <div className="p-4 pt-0">
        <InboxContainer feed={feed} />
      </div>
    </div>
  );
}
