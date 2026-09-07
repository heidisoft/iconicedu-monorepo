import type { Metadata } from 'next';

import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { ActivityFeedAuditDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/feed/activity-feed-audit-dashboard';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
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
    <AdminPageShell title="Activity feed">
      <AdminPageHeading
        title="Activity Feed"
        description="Audit generated activity items, delivery status, and pipeline jobs."
      />
      <ActivityFeedAuditDashboard audit={audit} />
    </AdminPageShell>
  );
}
