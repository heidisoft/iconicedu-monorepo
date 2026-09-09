import type { Metadata } from 'next';

import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { JobActivityOverview } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/job-activity-overview';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
import { getAdminJobActivity } from '@iconicedu/web/lib/admin/job-activity';

export const metadata: Metadata = {
  title: 'Admin · Job activity',
  description:
    'Track the last processed records for every background job across the platform.',
};

export default async function AdminJobActivityOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { account } = await getDashboardAccountContext(orgSlug);

  const overview = await getAdminJobActivity(account.org_id);

  return (
    <AdminPageShell title="Job activity">
      <AdminPageHeading
        title="Job activity"
        description="A shared view of every background job queue and the status of its most recent runs. Open a job for its last 50 processed records."
      />
      <JobActivityOverview overview={overview} basePath={`/${orgSlug}`} />
    </AdminPageShell>
  );
}
