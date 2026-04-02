import type { Metadata } from 'next';

import { AdminUserReportsSection, DashboardHeader } from '@iconicedu/ui-web';

import { loadAdminReportsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/_lib/load-admin-reports-dashboard';

export const metadata: Metadata = {
  title: 'Admin · User reports',
  description: 'Review user growth, usage, and cumulative growth trends.',
};

export default async function AdminUserReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const dashboard = await loadAdminReportsDashboard(orgSlug);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="User reports" />
      <div className="flex flex-1 flex-col gap-6 p-4">
        <AdminUserReportsSection dashboard={dashboard} />
      </div>
    </div>
  );
}
