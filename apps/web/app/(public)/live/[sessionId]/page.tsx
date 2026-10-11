import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LiveSessionSetup } from '@iconicedu/web/components/live-sessions/live-session-setup';
import { getLiveSessionReturnPath } from '@iconicedu/web/lib/live-sessions/navigation';
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
  searchParams: Promise<{ passcode?: string; returnTo?: string }>;
}) {
  const { sessionId } = await params;
  const { passcode, returnTo } = await searchParams;

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

  // flag-exempt: maintenance fixes to identity, setup and leave navigation for existing sessions.
  return (
    <LiveSessionSetup
      key={`${sessionId}:${authSession?.user?.id ?? 'guest'}`}
      sessionId={sessionId}
      sessionTitle={info.sessionTitle}
      settings={info.settings}
      initialCredentials={info.isHost ? info.hostJoin : null}
      initialPasscode={info.isHost ? info.hostJoin.passcode : (passcode ?? null)}
      participantName={
        info.isHost ? info.hostJoin.displayName : info.participant?.displayName
      }
      identityKey={
        info.isHost || info.participant ? (authSession?.user?.id ?? null) : null
      }
      accessToken={authSession?.access_token ?? null}
      students={!info.isHost ? info.participant?.students : undefined}
      returnPath={getLiveSessionReturnPath(returnTo)}
    />
  );
}
