import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';
import { Button, DashboardHeader } from '@iconicedu/ui-web';

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
      <DashboardHeader title="Session attendance detail" />
      <div className="flex flex-1 flex-col p-6 lg:p-8 gap-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href={`/${orgSlug}/admin/attendance/sessions`}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Attendance
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.session.channelTopic}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live attendance for this session.
            </p>
          </div>
        </div>
        <LiveSessionAttendanceDetail detail={detail} />
      </div>
    </div>
  );
}
