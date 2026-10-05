import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HostLiveSessionJoin } from '@iconicedu/web/components/live-sessions/host-live-session-join';
import { GuestLiveSessionJoinLanding } from '@iconicedu/web/components/live-sessions/guest-live-session-join-landing';
import { getPublicLiveSessionInfo } from '@iconicedu/web/lib/live-sessions/public-info';
import { createSupabaseServerClient } from '@iconicedu/web/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Join Live Session',
};

export default async function PublicLiveSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ passcode?: string }>;
}) {
  const { sessionId } = await params;
  const { passcode } = await searchParams;

  // Forwarding the visitor's own access token (if signed in) lets apps/api
  // determine host status — everything else about this session (existence,
  // provider, authorization) is resolved there too; this page only renders.
  const sessionSupabase = await createSupabaseServerClient();
  const {
    data: { session: authSession },
  } = await sessionSupabase.auth.getSession();

  const info = await getPublicLiveSessionInfo(
    sessionId,
    authSession?.access_token ?? null,
  );

  if (!info.exists) {
    notFound();
  }

  if (!info.isActive) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-xl font-semibold">Session has ended</h1>
        <p className="text-sm text-muted-foreground">
          This live session is no longer active.
        </p>
      </div>
    );
  }

  if (info.isHost) {
    return (
      <div className="flex min-h-screen flex-col gap-4 px-4 py-4">
        <HostLiveSessionJoin
          sessionName={info.hostJoin.sessionName}
          token={info.hostJoin.token}
          displayName={info.hostJoin.displayName}
          sessionTitle={info.sessionTitle}
          liveSessionId={sessionId}
          accessToken={authSession?.access_token ?? null}
          sessionPasscode={info.hostJoin.passcode}
        />
      </div>
    );
  }

  return (
    <GuestLiveSessionJoinLanding
      sessionId={sessionId}
      sessionTitle={info.sessionTitle}
      initialPasscode={passcode ?? null}
    />
  );
}
