import { buildActivityFeedForProfile } from '@iconicedu/web/lib/activity-feed/builders/activity-feed.builder';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { InboxPageClient } from '@iconicedu/web/app/(app)/[orgSlug]/inbox/inbox-page-client';

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { profileResponse } = await getDashboardProfileContext(supabase, account.id);
  const profileId = profileResponse.data?.id ?? '';
  const feed = await buildActivityFeedForProfile(supabase, account.org_id, profileId);

  return (
    <InboxPageClient
      orgId={account.org_id}
      orgSlug={orgSlug}
      profileId={profileId}
      feed={feed}
    />
  );
}
