import type { Metadata } from 'next';

import { AdminClassroomReportsSection, DashboardHeader } from '@iconicedu/ui-web';

import { loadAdminReportsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/reports/_lib/load-admin-reports-dashboard';

export const metadata: Metadata = {
  title: 'Admin · Classroom reports',
  description: 'Review session attendance and classroom delivery trends.',
};

export default async function AdminClassroomReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const dashboard = await loadAdminReportsDashboard(orgSlug);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Classrooms & sessions reports" />
      <div className="flex flex-1 flex-col gap-6 p-4">
        <AdminClassroomReportsSection dashboard={dashboard} />
      </div>
    </div>
  );
}
