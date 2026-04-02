import type { Metadata } from 'next';

import { AdminActivityReportsSection, DashboardHeader } from '@iconicedu/ui-web';

import { loadAdminReportsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/_lib/load-admin-reports-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Activity reports',
  description: 'Review activity trends across users, sessions, and channels.',
};

export default async function AdminActivityReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const dashboard = await loadAdminReportsDashboard(orgSlug);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Activity reports" />
      <div className="flex flex-1 flex-col gap-6 p-4">
        <AdminActivityReportsSection dashboard={dashboard} />
      </div>
    </div>
  );
}
