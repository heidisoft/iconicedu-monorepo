import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { DashboardHeader } from '@iconicedu/ui-web';
import { getDashboardAccountContext, getDashboardProfileContext } from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
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
    const { joinAccess, session } = await resolveLiveSessionJoinAccess({
      serviceSupabase: createSupabaseServiceClient(),
      liveSessionId: sessionId,
      profile: profileResponse.data,
    });

    if (joinAccess.joinUrl) {
      redirect(joinAccess.joinUrl);
    }

    return (
      <div className="flex h-[calc(100vh-1rem)] flex-col">
        <DashboardHeader />
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">{session.provider} live session</h1>
          <p className="text-sm text-muted-foreground">
            This provider did not return a browser join URL.
          </p>
        </div>
      </div>
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

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
