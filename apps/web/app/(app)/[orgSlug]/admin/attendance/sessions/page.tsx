import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { CompletedSessionsTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/completed-sessions-table';
import { SessionAttendanceDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-dashboard';
import { enableAdminSessionAttendanceAnalytics } from '@iconicedu/web/flags';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { listAdminSessionCompletions } from '@iconicedu/web/lib/api/session-completions';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Completed sessions',
  description: 'Review completed sessions across teachers and parents.',
};

export default async function AdminCompletedSessionsPage({
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

  const rows = await listAdminSessionCompletions(supabase, { orgId: org.id });
  const adminContext = await requireAdminOrgContext(org.id);
  const analyticsEnabled =
    adminContext.ok &&
    (await enableAdminSessionAttendanceAnalytics.run({
      identify: { profileId: adminContext.actorProfileId },
    }));

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Completed sessions" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Completed sessions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track confirmed session completions across teachers and parents.
            </p>
          </div>
        </div>
        {analyticsEnabled ? (
          <SessionAttendanceDashboard rows={rows} />
        ) : (
          <CompletedSessionsTable rows={rows} />
        )}
      </div>
    </div>
  );
}
