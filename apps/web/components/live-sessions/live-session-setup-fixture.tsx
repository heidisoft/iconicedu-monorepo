'use client';

import { useState } from 'react';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useLiveSessionNavigation } from './use-live-session-navigation';
import { Button } from '@iconicedu/ui-web/ui/button';
import { LiveSessionSetup, type LiveSessionMeetingProps } from './live-session-setup';
import { ZoomFeedbackScreen } from './zoom-video/zoom-feedback-screen';
import { clearLiveSessionRecovery } from '@iconicedu/web/lib/live-sessions/browser-session';

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
  const [left, setLeft] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  if (left)
    return (
      <ZoomFeedbackScreen
        rating={rating}
        isSubmitting={false}
        onRatingChange={setRating}
        onSkip={() => onLeave?.()}
        onSubmit={() => onLeave?.()}
      />
    );
  return (
    <main className="p-8">
      <h1>Meeting as {displayName}</h1>
      <p>{initialMuted ? 'Microphone off' : 'Microphone on'}</p>
      <p>{initialVideoOff ? 'Camera off' : 'Camera on'}</p>
      <Button
        onClick={() => {
          clearLiveSessionRecovery(liveSessionId);
          setLeft(true);
        }}
      >
        Leave meeting
      </Button>
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
