import type { Metadata } from 'next';

import { DashboardHeader } from '@iconicedu/ui-web';

import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { ActivityFeedAuditDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/feed/activity-feed-audit-dashboard';
import { getAdminActivityFeedAudit } from '@iconicedu/web/lib/admin/activity-feed-audit';

export const metadata: Metadata = {
  title: 'Admin · Activity feed',
  description: 'Inspect generated activity feed items by verb, user, and channel.',
};

export default async function AdminActivityFeedPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { account } = await getDashboardAccountContext(orgSlug);

  const audit = await getAdminActivityFeedAudit(account.org_id);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Activity feed" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Audit generated activity items, delivery status, and pipeline jobs.
            </p>
          </div>
        </div>
        <ActivityFeedAuditDashboard audit={audit} />
      </div>
    </div>
  );
}
