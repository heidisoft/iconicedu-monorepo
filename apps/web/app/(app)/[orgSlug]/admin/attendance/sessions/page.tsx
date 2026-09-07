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
  getCurrentCompletionMonthKey,
  isCompletionMonthKey,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/attendance/sessions/session-attendance-analytics';
import { enableAdminSessionAttendanceAnalytics } from '@iconicedu/web/flags';
import { requireAdminOrgContext } from '@iconicedu/web/lib/admin/require-admin-org-context';
import { listAdminSessionCompletions } from '@iconicedu/web/lib/api/session-completions';
import { buildOrgBySlug } from '@iconicedu/web/lib/org/builders/org.builder';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

const MONTH_FILTER_OPTION_COUNT = 12;

function resolveSelectedMonth(requested: string | undefined) {
  if (requested === ALL_COMPLETION_MONTHS || isCompletionMonthKey(requested ?? '')) {
    return requested as string;
  }
  return getCurrentCompletionMonthKey();
}

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

  // Only the analytics dashboard has a month filter; without it there is nothing
  // to change the window, so that view keeps loading every recorded month.
  const selectedMonth = analyticsEnabled
    ? resolveSelectedMonth(month)
    : ALL_COMPLETION_MONTHS;
  const range = completionMonthKeyToUtcRange(selectedMonth);
  const rows = await listAdminSessionCompletions(supabase, {
    orgId: org.id,
    completedSince: range?.since,
    completedUntil: range?.until,
  });

  const monthOptions = Array.from(
    new Set([
      getCurrentCompletionMonthKey(),
      ...buildRecentCompletionMonthKeys(MONTH_FILTER_OPTION_COUNT),
      ...(isCompletionMonthKey(selectedMonth) ? [selectedMonth] : []),
    ]),
  ).sort((a, b) => b.localeCompare(a));

  return (
    <AdminPageShell title="Completed sessions">
      <AdminPageHeading
        title="Completed sessions"
        description="Track confirmed session completions across teachers and parents."
      />
      {analyticsEnabled ? (
        <SessionAttendanceDashboard
          rows={rows}
          selectedMonth={selectedMonth}
          monthOptions={monthOptions}
        />
      ) : (
        <CompletedSessionsTable rows={rows} />
      )}
    </AdminPageShell>
  );
}
