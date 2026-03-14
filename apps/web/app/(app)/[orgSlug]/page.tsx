import { Suspense } from 'react';
import {
  DashboardHeader,
  DashboardHomeInfographicSection,
  DashboardHomeSkeleton,
  type DashboardRequestRole,
} from '@iconicedu/ui-web';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { DASHBOARD_CLASS_REQUEST_SUBJECT_OPTIONS } from '@iconicedu/web/lib/dashboard/class-request';
import { buildDashboardHomeInfographicMetrics } from '@iconicedu/web/lib/dashboard/home-infographic-metrics';

function resolveRequestRole(kind: string | undefined): DashboardRequestRole {
  if (kind === 'guardian') {
    return 'parents';
  }
  if (kind === 'child') {
    return 'students';
  }
  return 'other';
}

async function HomePageContent({ orgSlug }: { orgSlug: string }) {
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { currentUserProfile } = await getDashboardProfileContext(supabase, account.id);
  const metrics = await buildDashboardHomeInfographicMetrics({
    supabase,
    orgId: account.org_id,
    orgSlug,
    currentUserProfile,
  });

  const requestRole = resolveRequestRole(currentUserProfile?.kind);
  const canRequestClasses = requestRole === 'parents' || requestRole === 'students';
  const requestableStudents =
    currentUserProfile?.kind === 'guardian'
      ? (currentUserProfile.children?.items ?? []).map((child) => ({
          profileId: child.ids.id,
          displayName: child.profile.displayName,
        }))
      : currentUserProfile?.kind === 'child'
        ? [
            {
              profileId: currentUserProfile.ids.id,
              displayName: currentUserProfile.profile.displayName,
            },
          ]
        : [];

  return (
    <DashboardHomeInfographicSection
      orgSlug={orgSlug}
      isStaffView={metrics.isStaffView}
      isParentView={!metrics.isStaffView && metrics.activeRole === 'parents'}
      topMetrics={metrics.metricsByRole[metrics.activeRole]}
      upcomingSessionsPage={metrics.upcomingSessionsPage}
      calendarHref={metrics.calendarHref}
      inboxHref={metrics.inboxHref}
      browseHref={metrics.browseHref}
      canRequestClasses={canRequestClasses}
      requestRole={requestRole}
      requestableStudents={requestableStudents}
      subjectOptions={[...DASHBOARD_CLASS_REQUEST_SUBJECT_OPTIONS]}
    />
  );
}

export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title={'Home'} />
      <div className="flex flex-1 flex-col p-4">
        <Suspense fallback={<DashboardHomeSkeleton />}>
          <HomePageContent orgSlug={orgSlug} />
        </Suspense>
      </div>
    </div>
  );
}
