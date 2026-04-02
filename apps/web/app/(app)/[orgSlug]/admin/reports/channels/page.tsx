import type { Metadata } from 'next';

import { AdminChannelReportsSection, DashboardHeader } from '@iconicedu/ui-web';

import { loadAdminReportsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/_lib/load-admin-reports-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Channel reports',
  description: 'Review channel usage, message volume, and channel type mix.',
};

export default async function AdminChannelReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const dashboard = await loadAdminReportsDashboard(orgSlug);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Channel reports" />
      <div className="flex flex-1 flex-col gap-6 p-4">
        <AdminChannelReportsSection dashboard={dashboard} />
      </div>
    </div>
  );
}
