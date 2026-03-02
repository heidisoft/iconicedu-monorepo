import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DashboardHeader } from '@iconicedu/ui-web';

import { LiveSessionAttendanceDetail } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/[sessionId]/live-session-attendance-detail';
import { getAdminLiveSessionAttendanceDetail } from '@iconicedu/web/lib/admin/live-session-attendance';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Session attendance detail',
  description: 'Review participant attendance for a live session.',
};

export default async function AdminLiveSessionAttendanceDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; sessionId: string }>;
}) {
  const { orgSlug, sessionId } = await params;
  const supabase = await createSupabaseServerClient();
  const org = await buildOrgBySlug(supabase, orgSlug);

  if (!org) {
    notFound();
  }

  const detail = await getAdminLiveSessionAttendanceDetail(org.id, sessionId);
  if (!detail) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader
        title="Session attendance detail"
        description="Review participant attendance for this live session."
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <Link
            href={`/${orgSlug}/admin/attendance/sessions`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to session attendance
          </Link>
        </div>
        <LiveSessionAttendanceDetail detail={detail} />
      </div>
    </div>
  );
}
