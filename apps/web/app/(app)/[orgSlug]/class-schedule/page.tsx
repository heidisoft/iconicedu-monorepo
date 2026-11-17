import type { Metadata } from 'next';
import type { ClassScheduleVM, UserProfileVM } from '@iconicedu/shared-types';
import { buildClassSchedulesByOrg } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';
import { ClassScheduleClient } from '@iconicedu/web/app/(app)/[orgSlug]/class-schedule/class-schedule-client';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';

export const metadata: Metadata = {
  title: 'Class Schedule',
  description: 'Review upcoming classes, schedules, and daily learning sessions.',
};

function filterSchedulesForViewerProfile(
  schedules: ClassScheduleVM[],
  profile: UserProfileVM | null,
): ClassScheduleVM[] {
  if (!profile) {
    return [];
  }

  if (profile.kind === 'child') {
    return schedules.filter((schedule) =>
      schedule.participants.some(
        (participant) =>
          participant.ids.id === profile.ids.id && participant.role === 'child',
      ),
    );
  }

  if (profile.kind === 'educator') {
    return schedules.filter((schedule) =>
      schedule.participants.some(
        (participant) =>
          participant.ids.id === profile.ids.id && participant.role === 'educator',
      ),
    );
  }

  if (profile.kind === 'guardian') {
    const scopedProfileIds = new Set<string>([
      profile.ids.id,
      ...(profile.children?.items ?? []).map((child) => child.ids.id),
    ]);

    return schedules.filter((schedule) =>
      schedule.participants.some((participant) => {
        if (!scopedProfileIds.has(participant.ids.id)) {
          return false;
        }
        return participant.role === 'child' || participant.role === 'guardian';
      }),
    );
  }

  return schedules;
}

export default async function ClassSchedulePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { currentUserProfile } = await getDashboardProfileContext(supabase, account.id);
  const allEvents = await buildClassSchedulesByOrg(supabase, account.org_id);
  const events = filterSchedulesForViewerProfile(allEvents, currentUserProfile);
  const canManageSessions =
    account.primary_role === 'staff' || account.primary_role === 'owner';

  return (
    <ClassScheduleClient
      events={events}
      timezone={currentUserProfile?.prefs.timezone ?? null}
      orgSlug={orgSlug}
      canCancelSessions={canManageSessions}
      canEditSessions={canManageSessions}
    />
  );
}
