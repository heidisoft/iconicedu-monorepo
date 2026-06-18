import Link from 'next/link';
import type { Metadata } from 'next';

import { ArrowLeft } from 'lucide-react';
import { AdminChannelReportsSection, Button, DashboardHeader } from '@iconicedu/ui-web';

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
            <h1 className="text-2xl font-semibold tracking-tight">Channel Report</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Message volume and engagement metrics across all channels.
            </p>
          </div>
        </div>
        <AdminChannelReportsSection dashboard={dashboard} />
      </div>
    </div>
  );
}
