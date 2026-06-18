import Link from 'next/link';
import type { Metadata } from 'next';

import { ArrowLeft } from 'lucide-react';
import { AdminActivityReportsSection, Button, DashboardHeader } from '@iconicedu/ui-web';

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
            <h1 className="text-2xl font-semibold tracking-tight">Activity Report</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Breakdown of activity items by verb, user, and channel.
            </p>
          </div>
        </div>
        <AdminActivityReportsSection dashboard={dashboard} />
      </div>
    </div>
  );
}
