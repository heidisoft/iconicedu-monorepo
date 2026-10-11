'use client';

import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useLiveSessionNavigation } from './use-live-session-navigation';
import { Button } from '@iconicedu/ui-web/ui/button';
import { LiveSessionSetup, type LiveSessionMeetingProps } from './live-session-setup';
import { ZoomFeedbackScreen } from './zoom-video/zoom-feedback-screen';
import { useMeetingFeedback } from './zoom-video/use-meeting-feedback';

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
  liveSessionId,
  onLeave,
  initialMuted,
  initialVideoOff,
}: LiveSessionMeetingProps) => {
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
      <p>{initialMuted ? 'Microphone off' : 'Microphone on'}</p>
      <p>{initialVideoOff ? 'Camera off' : 'Camera on'}</p>
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
}: {
  actor: string;
  passcode?: string;
  returnPath?: string;
}) {
  const navigation = useLiveSessionNavigation();
  if (actor === 'dialog')
    return (
      <main className="p-8">
        <Button
          onClick={() =>
            navigation.handleResolvedJoinHref(
              `${window.location.origin}/live/fixture-host?passcode=demo`,
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
  return (
    <LiveSessionSetup
      sessionId={`fixture-${actor}`}
      sessionTitle="Test science class"
      initialCredentials={actor === 'host' ? hostCredentials : null}
      participantName={
        actor === 'guest' ? null : actor === 'host' ? 'Test Teacher' : 'Test Student'
      }
      initialPasscode={passcode}
      returnPath={returnPath}
      identityKey={actor === 'guest' ? null : `fixture-${actor}`}
      MeetingRenderer={FixtureMeeting}
    />
  );
}
