import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CompletedSessionsTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/completed-sessions-table';
import { SessionAttendanceDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-dashboard';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
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
    <AdminPageShell title="Completed sessions">
      <AdminPageHeading
        title="Completed sessions"
        description="Track confirmed session completions across teachers and parents."
      />
      {analyticsEnabled ? (
        <SessionAttendanceDashboard rows={rows} />
      ) : (
        <CompletedSessionsTable rows={rows} />
      )}
    </AdminPageShell>
  );
}
