'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DevicePreviewStep } from '@iconicedu/web/components/live-sessions/device-preview-step';
import {
  readLiveSessionRecovery,
  rememberLiveSession,
} from '@iconicedu/web/lib/live-sessions/browser-session';
import { ZoomSessionLoadingScreen } from './zoom-video/zoom-session-loading-screen';

const ZoomVideoSessionEmbed = dynamic(
  () =>
    import('@iconicedu/web/components/live-sessions/zoom-video-session-embed').then(
      (module) => module.ZoomVideoSessionEmbed,
    ),
  {
    ssr: false,
    loading: () => <ZoomSessionLoadingScreen />,
  },
);

export function HostLiveSessionJoin({
  sessionName,
  token,
  displayName,
  sessionTitle,
  liveSessionId,
  accessToken,
  sessionPasscode,
}: {
  sessionName: string;
  token: string;
  displayName: string;
  sessionTitle: string;
  liveSessionId: string;
  accessToken?: string | null;
  sessionPasscode?: string | null;
}) {
  const router = useRouter();
  const [devicePreferences, setDevicePreferences] = useState<{
    muted: boolean;
    videoOff: boolean;
  } | null>(null);
  const [recoveryChecked, setRecoveryChecked] = useState(false);

  useEffect(() => {
    setDevicePreferences(readLiveSessionRecovery(liveSessionId));
    setRecoveryChecked(true);
  }, [liveSessionId]);

  if (!recoveryChecked) {
    return <ZoomSessionLoadingScreen label="Restoring session…" />;
  }

  if (!devicePreferences) {
    return (
      <DevicePreviewStep
        displayName={displayName}
        sessionTitle={sessionTitle}
        onJoin={(preferences) => {
          rememberLiveSession(liveSessionId, preferences);
          setDevicePreferences(preferences);
        }}
      />
    );
  }

  return (
    <ZoomVideoSessionEmbed
      sessionName={sessionName}
      sessionTitle={sessionTitle}
      token={token}
      displayName={displayName}
      initialMuted={devicePreferences.muted}
      initialVideoOff={devicePreferences.videoOff}
      liveSessionId={liveSessionId}
      accessToken={accessToken}
      sessionPasscode={sessionPasscode}
      // This page is reached via the public /live/:sessionId link, which
      // doesn't carry an org-scoped return path — without this, leaving (or
      // finishing the post-session rating) did nothing at all, since
      // ZoomVideoSessionEmbed's onLeave prop was never passed here.
      onLeave={() => router.push('/')}
    />
  );
}
