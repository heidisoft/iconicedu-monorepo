import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { LiveSessionAttendanceTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/live-session-attendance-table';
import { getAdminLiveSessionAttendanceList } from '@iconicedu/web/lib/admin/live-session-attendance';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Session attendance',
  description: 'Review live session attendance across classes and channels.',
};

export default async function AdminLiveSessionAttendancePage({
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

  const rows = await getAdminLiveSessionAttendanceList(org.id);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Session attendance"
        description="Review live sessions, attendance counts, and session duration."
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <LiveSessionAttendanceTable orgSlug={orgSlug} rows={rows} />
      </div>
    </div>
  );
}
