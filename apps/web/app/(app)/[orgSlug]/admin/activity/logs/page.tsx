import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { ActivityEventsDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/activity/logs/activity-events-dashboard';
import { getAdminActivityEventRows } from '@iconicedu/web/lib/admin/activity-events';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Activity Logs',
  description: 'Inspect activity projection events and retry failed deliveries.',
};

export default async function AdminActivityLogsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createSupabaseServerClient();
  const org = await buildOrgBySlug(supabase, orgSlug);

  if (!org) {
    notFound();
  }

  const rows = await getAdminActivityEventRows(org.id);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Activity logs" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Activity Logs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Inspect raw activity events and their processing status.
            </p>
          </div>
        </div>
        <ActivityEventsDashboard orgId={org.id} rows={rows} />
      </div>
    </div>
  );
}
