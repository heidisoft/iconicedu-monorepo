import type { Metadata } from 'next';

import { AdminReportsOverview, DashboardHeader } from '@iconicedu/ui-web';

import { loadAdminReportsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/_lib/load-admin-reports-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Reports',
  description: 'Track growth, session delivery, attendance, and channel activity.',
};

export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const dashboard = await loadAdminReportsDashboard(orgSlug);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Reports" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <AdminReportsOverview dashboard={dashboard} />
      </div>
    </div>
  );
}
