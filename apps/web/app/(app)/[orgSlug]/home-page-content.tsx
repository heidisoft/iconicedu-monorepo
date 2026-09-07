import React from 'react';
import type { ClassRequestRole } from '@iconicedu/ui-web';

import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from './_shared/dashboard-auth';
import { buildDashboardHomeInfographicMetrics } from '../../../lib/dashboard/home-infographic-metrics';
import {
  listActiveOrgSubjectCatalog,
  mapOrgSubjectRowsToOptions,
} from '@iconicedu/web/lib/subjects/queries/org-subject-catalog.query';
import { HomePageInfographicClient } from './home-page-infographic-client';
import { getUserRoles } from '@iconicedu/web/lib/profile/queries/roles.query';
import { enableSessionCompletionCarousel } from '@iconicedu/web/flags';

// An org admin is a role grant (owner/admin/staff), not a profile kind — mirror
// requireAdminOrgContext so admins whose profile kind is educator/guardian still
// get the staff-facing org-wide "Sessions completed" totals.
function isAllowedAdminRole(roleKey: string | null | undefined) {
  return roleKey === 'owner' || roleKey === 'admin' || roleKey === 'staff';
}

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
  const sessionCompletionCarouselEnabled = await enableSessionCompletionCarousel.run({
    identify: { profileId: currentUserProfile?.ids.id ?? null },
  });
  const rolesResponse = await getUserRoles(supabase, account.id, account.org_id);
  const roleKeys = new Set<string | null | undefined>(
    (rolesResponse.data ?? []).map((role) => role.role_key),
  );
  roleKeys.add(account.primary_role);
  const isOrgAdminView = [...roleKeys].some(isAllowedAdminRole);
  const metrics = await buildDashboardHomeInfographicMetrics({
    supabase,
    orgId: account.org_id,
    orgSlug,
    currentUserProfile,
    timezone: currentUserProfile?.prefs.timezone ?? null,
    sessionCompletionCarouselEnabled,
    isOrgAdminView,
  });

  const requestRole = resolveRequestRole(currentUserProfile?.kind);
  const canRequestClasses = requestRole === 'parents' || requestRole === 'students';
  const subjectCatalogResponse = await listActiveOrgSubjectCatalog(
    supabase,
    account.org_id,
  );
  const subjectOptions = mapOrgSubjectRowsToOptions(subjectCatalogResponse.data);
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
    <HomePageInfographicClient
      orgSlug={orgSlug}
      isStaffView={metrics.isStaffView}
      isParentView={!metrics.isStaffView && metrics.activeRole === 'parents'}
      isStudentView={!metrics.isStaffView && metrics.activeRole === 'students'}
      isTutorView={!metrics.isStaffView && metrics.activeRole === 'tutors'}
      topMetrics={metrics.metricsByRole[metrics.activeRole]}
      upcomingSessionsPage={metrics.upcomingSessionsPage}
      completedSessionsPending={metrics.completedSessionsPending}
      sessionCompletionSummary={metrics.sessionCompletionSummary}
      calendarHref={metrics.calendarHref}
      notificationsHref={metrics.notificationsHref}
      browseHref={metrics.browseHref}
      canRequestClasses={canRequestClasses}
      requestRole={requestRole}
      requestableStudents={requestableStudents}
      subjectOptions={subjectOptions}
    />
  );
}
