import { buildClassSchedulesByOrg } from '@iconicedu/web/lib/schedules/builders/class-schedule.builder';
import { ClassScheduleClient } from '@iconicedu/web/app/(app)/[orgSlug]/class-schedule/class-schedule-client';
import { getDashboardAccountContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';

export default async function ClassSchedulePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const events = await buildClassSchedulesByOrg(supabase, account.org_id);

  return <ClassScheduleClient events={events} />;
}
