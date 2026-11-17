import { notFound } from 'next/navigation';
import { ClassroomCallDetails } from '@iconicedu/web/components/live-sessions/classroom-call-details';
import { enableClassroomCalls } from '@iconicedu/web/flags';
import {
  getDashboardAccountContext,
  getDashboardFamilyViewResolution,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
export default async function CallPage({
  params,
}: {
  params: Promise<{ callId: string; orgSlug: string }>;
}) {
  const { callId, orgSlug } = await params;
  const { account, supabase } = await getDashboardAccountContext(orgSlug);
  const family = await getDashboardFamilyViewResolution(supabase, account.id);
  if (
    !family ||
    !(await enableClassroomCalls.run({
      identify: { profileId: family.effectiveProfile.id },
    }))
  )
    notFound();
  return <ClassroomCallDetails key={callId} callId={callId} />;
}
