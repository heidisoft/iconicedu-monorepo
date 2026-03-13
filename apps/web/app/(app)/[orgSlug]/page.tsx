import { DashboardHeader, DashboardHomeInfographicSection } from '@iconicedu/ui-web';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { buildDashboardHomeInfographicMetrics } from '@iconicedu/web/lib/dashboard/home-infographic-metrics';

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { currentUserProfile } = await getDashboardProfileContext(supabase, account.id);
  const metrics = await buildDashboardHomeInfographicMetrics({
    supabase,
    orgId: account.org_id,
    orgSlug,
    currentUserProfile,
  });

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={'Home'} />
      <div className="flex flex-1 flex-col p-4">
        <DashboardHomeInfographicSection
          isStaffView={metrics.isStaffView}
          isParentView={!metrics.isStaffView && metrics.activeRole === 'parents'}
          topMetrics={metrics.metricsByRole[metrics.activeRole]}
          upcomingSessionsPage={metrics.upcomingSessionsPage}
          calendarHref={metrics.calendarHref}
          inboxHref={metrics.inboxHref}
          browseHref={metrics.browseHref}
        />
      </div>
    </div>
  );
}
