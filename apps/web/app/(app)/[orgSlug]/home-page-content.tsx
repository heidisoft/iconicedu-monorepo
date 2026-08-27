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
import { enableAnyVisibleClassSessionJoin } from '@iconicedu/web/flags';
import { applyJoinAvailabilityToUpcomingSessions } from '@iconicedu/web/lib/dashboard/apply-join-availability';
import { createLiveSessionsApiClient } from '@iconicedu/web/lib/live-sessions/api-client';

const UPCOMING_JOIN_AVAILABILITY_LOOKAHEAD_DAYS = 21;

/**
 * Ask the API which of the dashboard's upcoming occurrences this viewer can
 * actually join. One batched call for the whole page; a failure degrades to
 * "no Join controls" rather than rendering ones that would be rejected.
 */
async function loadUpcomingJoinAvailability(input: {
  supabase: Parameters<typeof createLiveSessionsApiClient>[0];
  orgSlug: string;
  profileId: string | null;
  now: Date;
}) {
  const toAt = new Date(input.now);
  toAt.setDate(toAt.getDate() + UPCOMING_JOIN_AVAILABILITY_LOOKAHEAD_DAYS);

  try {
    return await createLiveSessionsApiClient(
      input.supabase,
    ).listClassSessionJoinAvailability({
      orgSlug: input.orgSlug,
      actingProfileId: input.profileId,
      fromAt: input.now.toISOString(),
      toAt: toAt.toISOString(),
    });
  } catch {
    return [];
  }
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
  const metrics = await buildDashboardHomeInfographicMetrics({
    supabase,
    orgId: account.org_id,
    orgSlug,
    currentUserProfile,
    timezone: currentUserProfile?.prefs.timezone ?? null,
  });

  const anyVisibleJoinEnabled = await enableAnyVisibleClassSessionJoin.run({
    identify: { profileId: currentUserProfile?.ids.id ?? null },
  });
  const upcomingSessionsPage = anyVisibleJoinEnabled
    ? applyJoinAvailabilityToUpcomingSessions(
        metrics.upcomingSessionsPage,
        await loadUpcomingJoinAvailability({
          supabase,
          orgSlug,
          profileId: currentUserProfile?.ids.id ?? null,
          now: new Date(),
        }),
      )
    : metrics.upcomingSessionsPage;

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
      upcomingSessionsPage={upcomingSessionsPage}
      anyVisibleJoinEnabled={anyVisibleJoinEnabled}
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
