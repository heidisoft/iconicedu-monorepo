'use client';
import { useEffect, useState } from 'react';
import { subscribeMeetingDeviceRecovery } from '@iconicedu/web/lib/live-sessions/browser-device-recovery';
import { MeetingConnectionRecovery } from './zoom-video/meeting-connection-recovery';

import { LiveSessionJoinContext } from '@iconicedu/ui-web/components/messages/live-session-join-context';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useLiveSessionNavigation } from './use-live-session-navigation';
import { Button } from '@iconicedu/ui-web/ui/button';
import { LiveSessionLinkEntry } from './live-session-link-entry';
import { LiveSessionSetup, type LiveSessionMeetingProps } from './live-session-setup';
import { MeetingWaitingRoom } from './zoom-video/meeting-waiting-room';
import { ZoomFeedbackScreen } from './zoom-video/zoom-feedback-screen';
import { useMeetingFeedback } from './zoom-video/use-meeting-feedback';

const parentStudents = [
  { profileId: '11111111-1111-4111-8111-111111111111', displayName: 'Alice' },
  { profileId: '22222222-2222-4222-8222-222222222222', displayName: 'Ben' },
];

const hostCredentials = {
  token: 'synthetic-host-token',
  sessionName: 'fixture-class',
  displayName: 'Test Teacher',
  expiresAt: null,
};

/** Isolate setup from Zoom's external service while exercising production setup,
 * device preview, recovery, feedback presentation and router navigation.
 */
const FixtureMeeting = ({
  displayName,
  token,
  settings,
  meetingLinkToken,
  liveSessionId,
  onLeave,
  initialMuted,
  initialVideoOff,
  initialCameraId,
  initialMicrophoneId,
  initialMediaSettings,
}: LiveSessionMeetingProps) => {
  const [failed, setFailed] = useState(false);
  const [deviceRefreshes, setDeviceRefreshes] = useState(0);
  useEffect(
    () => subscribeMeetingDeviceRecovery(() => setDeviceRefreshes((count) => count + 1)),
    [],
  );
  let canAdmit = false;
  try {
    canAdmit = JSON.parse(atob(token.split('.')[1])).role_type === 1;
  } catch {
    /* Older synthetic fixtures do not use JWTs. */
  }
  const feedback = useMeetingFeedback({ liveSessionId, displayName, onLeave });
  if (feedback.hasLeft) return null;
  if (feedback.showFeedbackPrompt)
    return (
      <ZoomFeedbackScreen
        rating={feedback.feedbackRating}
        isSubmitting={feedback.isFeedbackSubmitting}
        onRatingChange={feedback.setFeedbackRating}
        onSkip={feedback.finishLeaving}
        onSubmit={() => void feedback.submitFeedback()}
      />
    );
  return (
    <main className="p-8">
      <h1>Meeting as {displayName}</h1>
      <p data-testid="device-refreshes">{deviceRefreshes}</p>
      <Button onClick={() => setFailed(true)}>Simulate connection failure</Button>
      {failed && (
        <MeetingConnectionRecovery
          message="The connection failed. Please rejoin the class."
          onLeave={() => feedback.beginFeedback()}
        />
      )}
      {canAdmit && settings?.access?.mode !== 'open' ? (
        <MeetingWaitingRoom sessionId={liveSessionId} linkToken={meetingLinkToken} />
      ) : null}
      <p>{initialMuted ? 'Microphone off' : 'Microphone on'}</p>
      <p>{initialVideoOff ? 'Camera off' : 'Camera on'}</p>
      {initialCameraId && <p>Camera device: {initialCameraId}</p>}
      {initialMicrophoneId && <p>Microphone device: {initialMicrophoneId}</p>}
      {initialMediaSettings && (
        <p>Media preferences: {JSON.stringify(initialMediaSettings)}</p>
      )}
      <Button
        onClick={() => {
          feedback.beginFeedback();
        }}
      >
        Leave meeting
      </Button>
      <Button onClick={() => feedback.beginFeedback()}>Host ended meeting</Button>
    </main>
  );
};

export function LiveSessionSetupFixture({
  actor,
  passcode,
  returnPath,
  sessionId,
}: {
  actor: string;
  sessionId?: string;
  passcode?: string;
  returnPath?: string;
}) {
  if (actor === 'dialog')
    return (
      <LiveSessionJoinContext.Provider
        value={{
          joinChannel: async () => ({
            joinPath: '/live/aaaa-bbbb-cccc',
            provider: 'zoom',
          }),
          resolveLink: async () => ({
            joinPath: `${window.location.origin}/live/aaaa-bbbb-cccc`,
            sharePath: `${window.location.origin}/live/aaaa-bbbb-cccc#invite=${'a'.repeat(32)}`,
            provider: 'zoom',
            passcode: 'DemoPass12',
          }),
        }}
      >
        <ReadyDialogFixture />
      </LiveSessionJoinContext.Provider>
    );
  if (actor === 'link' && sessionId)
    return (
      <LiveSessionLinkEntry
        sessionId={sessionId}
        sessionTitle="Test class"
        MeetingRenderer={FixtureMeeting}
      />
    );
  return (
    <LiveSessionSetup
      sessionId={`fixture-${actor}`}
      sessionTitle="Test science class"
      initialCredentials={actor === 'host' ? hostCredentials : null}
      participantName={
        actor === 'guest' ? null : actor === 'host' ? 'Test Teacher' : 'Test Student'
      }
      students={actor === 'parent' ? parentStudents : undefined}
      initialPasscode={passcode}
      passcodeRequired={actor === 'guest'}
      returnPath={returnPath}
      identityKey={actor === 'guest' ? null : `fixture-${actor}`}
      MeetingRenderer={FixtureMeeting}
    />
  );
}

function ReadyDialogFixture() {
  const navigation = useLiveSessionNavigation();
  return (
    <main className="p-8">
      <Button
        onClick={() =>
          navigation.handleResolvedJoinHref(
            `${window.location.origin}/live/aaaa-bbbb-cccc`,
            'zoom',
          )
        }
      >
        Join live session
      </Button>
      <ExternalLiveSessionJoinDialog
        target={navigation.externalJoinTarget}
        onOpenChange={(open) => {
          if (!open) navigation.closeExternalJoinDialog();
        }}
      />
    </main>
  );
}
