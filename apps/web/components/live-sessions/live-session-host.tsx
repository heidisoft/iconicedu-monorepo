'use client';

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

export function LiveSessionHost({
  provider,
  joinUrl,
  channelTopic,
  channelPurpose,
}: {
  provider: LiveSessionProviderVM;
  joinUrl?: string | null;
  channelTopic?: string | null;
  channelPurpose?: string | null;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const heading = getLiveSessionHostHeading({ provider, channelTopic });
  const subheading = getLiveSessionHostSubheading({ purpose: channelPurpose });

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
          <a href={joinUrl} target="_blank" rel="noreferrer">
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
          src={joinUrl}
          className="h-full min-h-[70vh] w-full border-0"
          allow={getEmbeddedLiveSessionFrameAllow(provider)}
          allowFullScreen
          onLoad={() => setIsLoaded(true)}
        />
      </div>
    </div>
  );
}
