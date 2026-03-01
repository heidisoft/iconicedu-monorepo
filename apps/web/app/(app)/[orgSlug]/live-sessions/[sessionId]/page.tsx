import { DashboardHeader } from '@iconicedu/ui-web';
import { getDashboardAccountContext, getDashboardProfileContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { LiveSessionHost } from '@iconicedu/web/components/live-sessions/live-session-host';
import { resolveLiveSessionJoinAccess } from '@iconicedu/web/lib/live-sessions/service';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; sessionId: string }>;
}) {
  const { orgSlug, sessionId } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { profileResponse } = await getDashboardProfileContext(supabase, account.id);

  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  try {
    const serviceSupabase = createSupabaseServiceClient();
    const { joinAccess, session } = await resolveLiveSessionJoinAccess({
      serviceSupabase,
      liveSessionId: sessionId,
      profile: profileResponse.data,
    });
    const channelResponse = await serviceSupabase
      .from('channels')
      .select('topic, purpose')
      .eq('id', session.channel_id)
      .eq('org_id', session.org_id)
      .is('deleted_at', null)
      .maybeSingle<{ topic: string; purpose: string }>();

    return (
      <div className="flex h-[calc(100vh-1rem)] flex-col">
        <DashboardHeader />
        <LiveSessionHost
          provider={session.provider as 'daily' | 'zoom' | 'jitsi' | 'custom'}
          joinUrl={joinAccess.joinUrl ?? null}
          channelTopic={channelResponse.data?.topic ?? null}
          channelPurpose={channelResponse.data?.purpose ?? null}
        />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live session unavailable';

    return (
      <div className="flex h-[calc(100vh-1rem)] flex-col">
        <DashboardHeader />
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">Live session unavailable</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }
}
