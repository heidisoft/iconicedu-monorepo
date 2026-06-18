import Link from 'next/link';
import type { Metadata } from 'next';

import { ArrowLeft } from 'lucide-react';
import { AdminClassroomReportsSection, Button, DashboardHeader } from '@iconicedu/ui-web';

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
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href={`/${orgSlug}/admin/reports`}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Reports
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Classroom Report</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Session delivery and participation across all classrooms.
            </p>
          </div>
        </div>
        <AdminClassroomReportsSection dashboard={dashboard} />
      </div>
    </div>
  );
}
