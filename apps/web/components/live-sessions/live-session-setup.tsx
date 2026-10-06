'use client';

import { useRouter } from 'next/navigation';
import type { ComponentType, ComponentProps } from 'react';
import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionSettingsVM,
} from '@iconicedu/shared-types';
import { getLiveSessionReturnPath } from '@iconicedu/web/lib/live-sessions/navigation';
import { DevicePreviewStep } from './device-preview-step';
import { LiveSessionJoinForm } from './live-session-join-form';
import { ZoomMeetingRenderer } from './zoom-meeting-renderer';
import { ZoomSessionLoadingScreen } from './zoom-video/zoom-session-loading-screen';
import { useLiveSessionSetup } from './use-live-session-setup';

export type LiveSessionMeetingProps = ComponentProps<typeof ZoomMeetingRenderer>;
export type LiveSessionMeetingRenderer = ComponentType<LiveSessionMeetingProps>;

/** Public /live composition root. All meeting navigation stays outside the SDK renderer.
 * Inject a renderer in tests to exercise the complete flow without Zoom or real credentials.
 */
export function LiveSessionSetup({
  sessionId,
  sessionTitle,
  initialCredentials,
  initialPasscode,
  participantName,
  accessToken,
  identityKey,
  settings,
  returnPath = '/',
  MeetingRenderer = ZoomMeetingRenderer,
}: {
  sessionId: string;
  sessionTitle: string;
  initialCredentials?: LiveSessionJoinCredentialsVM | null;
  initialPasscode?: string | null;
  participantName?: string | null;
  accessToken?: string | null;
  identityKey?: string | null;
  settings?: LiveSessionSettingsVM;
  returnPath?: string;
  MeetingRenderer?: LiveSessionMeetingRenderer;
}) {
  const router = useRouter();
  const setup = useLiveSessionSetup({
    sessionId,
    initialCredentials,
    initialPasscode,
    participantName,
    accessToken,
    identityKey,
  });
  if (!setup.ready) return <ZoomSessionLoadingScreen label="Restoring session…" />;
  if (!setup.credentials)
    return (
      <LiveSessionJoinForm
        sessionTitle={sessionTitle}
        participantName={participantName}
        initialPasscode={initialPasscode}
        busy={setup.busy}
        error={setup.error}
        onSubmit={setup.requestJoin}
      />
    );
  if (!setup.preferences)
    return (
      <DevicePreviewStep
        displayName={setup.credentials.displayName}
        sessionTitle={sessionTitle}
        onJoin={setup.join}
      />
    );
  return (
    <div className="flex min-h-screen flex-col gap-4 px-4 py-4">
      <MeetingRenderer
        sessionName={setup.credentials.sessionName}
        token={setup.credentials.token}
        displayName={setup.credentials.displayName}
        sessionTitle={sessionTitle}
        settings={setup.credentials.settings ?? settings}
        liveSessionId={sessionId}
        sessionPasscode={setup.passcode}
        accessToken={accessToken}
        initialMuted={setup.preferences.muted}
        initialVideoOff={setup.preferences.videoOff}
        onLeave={() => {
          setup.leave();
          router.replace(getLiveSessionReturnPath(returnPath));
        }}
      />
    </div>
  );
}
