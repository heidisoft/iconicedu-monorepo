import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { LiveSessionMemberAccessVM } from '@iconicedu/shared-types';
import { DashboardHeader } from '@iconicedu/ui-web';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { LiveSessionHost } from '@iconicedu/web/components/live-sessions/live-session-host';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
export const metadata: Metadata = {
  title: 'Live Session',
  description: 'Join your live tutoring session.',
};
/** flag-exempt: prevents legacy URLs bypassing the existing Zoom preview/admission flow. */
export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; sessionId: string }>;
}) {
  const { orgSlug, sessionId } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { profileResponse } = await getDashboardProfileContext(supabase, account.id);
  if (!profileResponse.data) throw new Error('Profile not found');
  let access: LiveSessionMemberAccessVM;
  try {
    access = await createApiClient(supabase).post<LiveSessionMemberAccessVM>(
      `/live-sessions/${encodeURIComponent(sessionId)}/member-access`,
      { orgId: account.org_id, profileId: profileResponse.data.id },
    );
  } catch {
    return (
      <div className="flex h-[calc(100vh-1rem)] flex-col">
        <DashboardHeader />
        <div className="m-auto p-6 text-center">
          <h1 className="text-xl font-semibold">Live session unavailable</h1>
          <p>Please return to your classroom and try joining again.</p>
        </div>
      </div>
    );
  }
  if (access.provider === 'zoom')
    redirect(`${access.joinPath}?returnTo=${encodeURIComponent(access.returnPath)}`);
  return (
    <div className="flex h-[calc(100vh-1rem)] flex-col">
      <DashboardHeader />
      <LiveSessionHost
        provider={access.provider}
        joinUrl={access.joinUrl}
        token={access.token}
        externalJoinUrl={access.externalJoinUrl}
        displayName={access.displayName}
        channelKind={access.channelKind}
        mode={access.mode}
        channelTopic={access.channelTopic}
        channelPurpose={access.channelPurpose}
        returnPath={access.returnPath}
        liveSessionId={sessionId}
      />
    </div>
  );
}
