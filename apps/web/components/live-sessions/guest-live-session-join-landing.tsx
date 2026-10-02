'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';

import {
  guestJoinLiveSession,
  type GuestLiveSessionJoinResult,
} from '@iconicedu/web/lib/live-sessions/public-api';
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

export function GuestLiveSessionJoinLanding({
  sessionId,
  sessionTitle,
  initialPasscode,
}: {
  sessionId: string;
  sessionTitle: string;
  initialPasscode?: string | null;
}) {
  const [displayName, setDisplayName] = useState('');
  const [passcode, setPasscode] = useState(initialPasscode ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState<GuestLiveSessionJoinResult | null>(null);
  const [joined, setJoined] = useState<
    | (GuestLiveSessionJoinResult & { initialMuted: boolean; initialVideoOff: boolean })
    | null
  >(null);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!displayName.trim() || !passcode.trim()) {
        return;
      }

      setIsSubmitting(true);
      setError(null);
      const result = await guestJoinLiveSession(sessionId, {
        displayName: displayName.trim(),
        passcode: passcode.trim(),
      });
      setIsSubmitting(false);

      if ('status' in result) {
        setError(result.message);
        return;
      }

      setPendingJoin(result);
    },
    [displayName, passcode, sessionId],
  );

  if (joined) {
    return (
      <div className="flex min-h-screen flex-col gap-4 px-4 py-4">
        <ZoomVideoSessionEmbed
          sessionName={joined.sessionName}
          token={joined.token}
          displayName={joined.displayName}
          initialMuted={joined.initialMuted}
          initialVideoOff={joined.initialVideoOff}
          liveSessionId={sessionId}
          onLeave={() => {
            setJoined(null);
            setPendingJoin(null);
          }}
        />
      </div>
    );
  }

  if (pendingJoin) {
    return (
      <DevicePreviewStep
        displayName={pendingJoin.displayName}
        sessionTitle={sessionTitle}
        onJoin={({ muted: initialMuted, videoOff: initialVideoOff }) =>
          setJoined({ ...pendingJoin, initialMuted, initialVideoOff })
        }
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{sessionTitle}</h1>
        <p className="text-sm text-muted-foreground">
          Enter your name{initialPasscode ? '' : ' and the session passcode'} to join.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="guest-display-name">Your name</Label>
          <Input
            id="guest-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Jordan Lee"
            autoFocus
            required
          />
        </div>

        {initialPasscode ? null : (
          <div className="space-y-2">
            <Label htmlFor="guest-passcode">Session passcode</Label>
            <Input
              id="guest-passcode"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              placeholder="Enter the passcode you were given"
              required
            />
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Join session
        </Button>
      </form>
    </div>
  );
}
