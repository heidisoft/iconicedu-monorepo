'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Loader2, MonitorUp } from 'lucide-react';

import type { LiveSessionProviderVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  canEmbedLiveSession,
  getEmbeddedLiveSessionFrameAllow,
  getEmbeddedLiveSessionTitle,
} from '@iconicedu/web/lib/live-sessions/embed';
import {
  getLiveSessionHostHeading,
  getLiveSessionHostSubheading,
} from '@iconicedu/web/components/live-sessions/live-session-host.utils';

const DailyLiveSessionEmbed = dynamic(
  () =>
    import('@iconicedu/web/components/live-sessions/daily-live-session-embed').then(
      (module) => module.DailyLiveSessionEmbed,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[70vh] items-center justify-center rounded-2xl border border-border bg-black">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading live session...
        </div>
      </div>
    ),
  },
);

export function LiveSessionHost({
  provider,
  joinUrl,
  token,
  externalJoinUrl,
  channelKind,
  mode,
  channelTopic,
  channelPurpose,
  returnPath,
}: {
  provider: LiveSessionProviderVM;
  joinUrl?: string | null;
  token?: string | null;
  externalJoinUrl?: string | null;
  channelKind?: string | null;
  mode?: 'video' | 'audio' | null;
  channelTopic?: string | null;
  channelPurpose?: string | null;
  returnPath: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const heading = getLiveSessionHostHeading({ provider, channelTopic });
  const subheading = getLiveSessionHostSubheading({ purpose: channelPurpose });

  if (provider === 'daily' && joinUrl) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{heading}</h1>
            <p className="text-sm text-muted-foreground">{subheading}</p>
          </div>
        </div>
        <DailyLiveSessionEmbed
          joinUrl={joinUrl}
          token={token ?? null}
          externalJoinUrl={externalJoinUrl ?? null}
          channelKind={channelKind ?? null}
          mode={mode ?? null}
          returnPath={returnPath}
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
          <p className="text-sm text-muted-foreground">{subheading}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={(externalJoinUrl ?? joinUrl) ?? undefined} target="_blank" rel="noreferrer">
            <MonitorUp className="h-4 w-4" />
            Open in new tab
          </a>
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-black">
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
