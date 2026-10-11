'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, MonitorUp } from 'lucide-react';

import type { LiveSessionProviderVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  canEmbedLiveSession,
  getEmbeddedLiveSessionFrameAllow,
  getEmbeddedLiveSessionTitle,
} from '@iconicedu/web/lib/live-sessions/embed';
import { getLiveSessionHostHeading } from '@iconicedu/web/components/live-sessions/live-session-host.utils';
import { ZoomMeetingRenderer as ZoomVideoSessionEmbed } from './zoom-meeting-renderer';
import { ZoomSessionLoadingScreen } from './zoom-video/zoom-session-loading-screen';

const DailyLiveSessionEmbed = dynamic(
  () =>
    import('@iconicedu/web/components/live-sessions/daily-live-session-embed').then(
      (module) => module.DailyLiveSessionEmbed,
    ),
  {
    ssr: false,
    loading: () => <ZoomSessionLoadingScreen label="Loading live session…" />,
  },
);

export function LiveSessionHost({
  provider,
  joinUrl,
  token,
  externalJoinUrl,
  zoomSessionName,
  zoomPasscode,
  displayName,
  channelKind,
  mode,
  channelTopic,
  channelPurpose,
  returnPath,
  liveSessionId,
  accessToken,
}: {
  provider: LiveSessionProviderVM;
  joinUrl?: string | null;
  token?: string | null;
  externalJoinUrl?: string | null;
  zoomSessionName?: string | null;
  zoomPasscode?: string | null;
  displayName?: string | null;
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
  channelTopic?: string | null;
  channelPurpose?: string | null;
  returnPath: string;
  liveSessionId: string;
  accessToken?: string | null;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();
  const heading = getLiveSessionHostHeading({ provider, channelTopic });

  if (provider === 'daily' && joinUrl) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <DailyLiveSessionEmbed
          joinUrl={joinUrl}
          token={token ?? null}
          externalJoinUrl={externalJoinUrl ?? null}
          channelKind={channelKind ?? null}
          mode={mode ?? null}
          returnPath={returnPath}
          meetingName={heading}
        />
      </div>
    );
  }

  // Zoom's join_path normally points members at the public /live/<id> page
  // directly (see join.ts), so this branch isn't on the usual path — it's
  // defense-in-depth for the case where this internal page gets reached for
  // a Zoom-provider session (an old link, a session row from before a
  // provider switch, etc.) instead of silently showing a dead "no embeddable
  // join URL" error.
  if (provider === 'zoom' && token && zoomSessionName) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
        <ZoomVideoSessionEmbed
          sessionName={zoomSessionName}
          sessionPasscode={zoomPasscode}
          sessionTitle={heading}
          token={token}
          displayName={displayName ?? 'You'}
          liveSessionId={liveSessionId}
          accessToken={accessToken}
          onLeave={() => router.push(returnPath)}
        />
      </div>
    );
  }

  if (!canEmbedLiveSession(joinUrl)) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          This provider did not return an embeddable join URL.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{heading}</h1>
          <p className="text-sm text-muted-foreground">
            {channelPurpose ?? 'Live session'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a
            href={externalJoinUrl ?? joinUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
          >
            <MonitorUp className="h-4 w-4" />
            Open in new tab
          </a>
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
        {!isLoaded ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading live session...
            </div>
          </div>
        ) : null}
        <iframe
          title={getEmbeddedLiveSessionTitle(provider)}
          src={joinUrl ?? undefined}
          className="h-full min-h-[70vh] w-full border-0"
          allow={getEmbeddedLiveSessionFrameAllow(provider)}
          allowFullScreen
          onLoad={() => setIsLoaded(true)}
        />
      </div>
    </div>
  );
}
