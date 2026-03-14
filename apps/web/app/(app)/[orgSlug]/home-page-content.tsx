import React from 'react';
import { DashboardHomeInfographicSection } from '@iconicedu/ui-web';
import type { ClassRequestRole } from '@iconicedu/ui-web';

import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from './_shared/dashboard-auth';
import { DASHBOARD_CLASS_REQUEST_SUBJECT_OPTIONS } from '../../../lib/dashboard/class-request';
import { buildDashboardHomeInfographicMetrics } from '../../../lib/dashboard/home-infographic-metrics';

function resolveRequestRole(kind: string | undefined): ClassRequestRole {
  if (kind === 'guardian') {
    return 'parents';
  }
  if (kind === 'child') {
    return 'students';
  }
  return 'other';
}

export async function HomePageContent({ orgSlug }: { orgSlug: string }) {
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
