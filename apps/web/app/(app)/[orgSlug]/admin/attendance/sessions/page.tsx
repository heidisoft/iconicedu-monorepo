import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CompletedSessionsTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/completed-sessions-table';
import { SessionAttendanceDashboard } from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-dashboard';
import {
  AdminPageHeading,
  AdminPageShell,
} from '@iconicedu/web/components/admin/admin-page-layout';
import {
  ALL_COMPLETION_MONTHS,
  buildRecentCompletionMonthKeys,
  completionMonthKeyToUtcRange,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-analytics';
import { enableAdminSessionAttendanceAnalytics } from '@iconicedu/web/flags';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import {
  listAdminSessionCompletions,
  listOrgRosterForAdmin,
} from '@iconicedu/web/lib/api/session-completions';
import { listSchedules } from '@iconicedu/web/lib/api/schedules';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Admin · Completed sessions',
  description: 'Review completed sessions across teachers and parents.',
};

export default async function AdminCompletedSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { orgSlug } = await params;
  const { month } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const org = await buildOrgBySlug(supabase, orgSlug);

  if (!org) {
    notFound();
  }

  const adminContext = await requireAdminOrgContext(org.id);
  const analyticsEnabled =
    adminContext.ok &&
    (await enableAdminSessionAttendanceAnalytics.run({
      identify: { profileId: adminContext.actorProfileId },
    }));

  // A rolling three-month interval can intersect four calendar months.
  // The API clamps both month requests and the default view to that interval.
  const monthOptions = buildRecentCompletionMonthKeys();
  const selectedMonth =
    analyticsEnabled && month && monthOptions.includes(month)
      ? month
      : ALL_COMPLETION_MONTHS;

  if (!analyticsEnabled) {
    const rows = await listAdminSessionCompletions(supabase, { orgId: org.id });
    const schedules = await listSchedules(supabase, { orgId: org.id });
    return (
      <AdminPageShell title="Completed sessions">
        <AdminPageHeading
          title="Completed sessions"
          description="Review session confirmations from the past three months."
        />
        <CompletedSessionsTable rows={rows} schedules={schedules} orgId={org.id} />
      </AdminPageShell>
    );
  }

  const range = completionMonthKeyToUtcRange(selectedMonth);
  // Each promise is kicked off here (not awaited) and handed straight to the
  // client dashboard, which unwraps it per-section with `use()` inside its own
  // Suspense boundary — a slow query for one section (e.g. the roster) never
  // blocks the others from painting. The trend chart deliberately reads its own
  // unscoped fetch instead of `rowsPromise`, so it always covers the full
  // rolling three-month window regardless of the month/participant/method
  // filters applied to the rest of the page.
  const rowsPromise = listAdminSessionCompletions(supabase, {
    orgId: org.id,
    completedSince: range?.since,
    completedUntil: range?.until,
  });
  const trendRowsPromise = listAdminSessionCompletions(supabase, { orgId: org.id });
  const rosterPromise = Promise.all([
    listOrgRosterForAdmin(supabase, { orgId: org.id, kind: 'educator' }),
    listOrgRosterForAdmin(supabase, { orgId: org.id, kind: 'guardian' }),
  ]);
  const schedulesPromise = listSchedules(supabase, { orgId: org.id });

  return (
    <AdminPageShell title="Completed sessions">
      <AdminPageHeading
        title="Completed sessions"
        description="Review session confirmations from the past three months."
      />
      <SessionAttendanceDashboard
        rowsPromise={rowsPromise}
        trendRowsPromise={trendRowsPromise}
        rosterPromise={rosterPromise}
        schedulesPromise={schedulesPromise}
        selectedMonth={selectedMonth}
        monthOptions={monthOptions}
        orgId={org.id}
      />
    </AdminPageShell>
  );
}
