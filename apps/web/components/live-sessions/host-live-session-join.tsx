'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { DevicePreviewStep } from '@iconicedu/web/components/live-sessions/device-preview-step';

const ZoomVideoSessionEmbed = dynamic(
  () =>
    import('@iconicedu/web/components/live-sessions/zoom-video-session-embed').then(
      (module) => module.ZoomVideoSessionEmbed,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[70vh] items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading session...
        </div>
      </div>
    ),
  },
);

export function HostLiveSessionJoin({
  sessionName,
  token,
  displayName,
  sessionTitle,
  liveSessionId,
  accessToken,
}: {
  sessionName: string;
  token: string;
  displayName: string;
  sessionTitle: string;
  liveSessionId: string;
  accessToken?: string | null;
}) {
  const router = useRouter();
  const [devicePreferences, setDevicePreferences] = useState<{
    muted: boolean;
    videoOff: boolean;
  } | null>(null);

  if (!devicePreferences) {
    return (
      <DevicePreviewStep
        displayName={displayName}
        sessionTitle={sessionTitle}
        onJoin={setDevicePreferences}
      />
    );
  }

  return (
    <ZoomVideoSessionEmbed
      sessionName={sessionName}
      token={token}
      displayName={displayName}
      initialMuted={devicePreferences.muted}
      initialVideoOff={devicePreferences.videoOff}
      liveSessionId={liveSessionId}
      accessToken={accessToken}
      // This page is reached via the public /live/:sessionId link, which
      // doesn't carry an org-scoped return path — without this, leaving (or
      // finishing the post-session rating) did nothing at all, since
      // ZoomVideoSessionEmbed's onLeave prop was never passed here.
      onLeave={() => router.push('/')}
    />
  );
}
