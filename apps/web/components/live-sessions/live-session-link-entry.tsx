'use client';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import type { PublicLiveSessionInfoVM } from '@iconicedu/shared-types';
import { ApiHttpError, createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
import { Alert, AlertDescription, AlertTitle } from '@iconicedu/ui-web/ui/alert';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  readMeetingLink,
  writeMeetingLink,
  clearMeetingLink,
  newRedemptionKey,
} from '@iconicedu/web/lib/live-sessions/link-recovery';
import { LiveSessionSetup } from './live-session-setup';
import { ZoomSessionLoadingScreen } from './zoom-video/zoom-session-loading-screen';
// flag-exempt: seamless admission for the existing shared meeting links and mobile join flow.
export function LiveSessionLinkEntry(props: ComponentProps<typeof LiveSessionSetup>) {
  const [resolved, setResolved] = useState<{
    info: PublicLiveSessionInfoVM;
    linkToken: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const personal = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<Promise<{
    info: PublicLiveSessionInfoVM;
    linkToken: string;
  }> | null>(null);
  useEffect(() => {
    let active = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const fragmentToken = fragment.get('handoff') ?? fragment.get('invite');
    const stored = readMeetingLink(props.sessionId);
    const recovery = fragmentToken
      ? {
          token: fragmentToken,
          personal: fragment.has('handoff'),
          handoff: fragment.has('handoff'),
          redemptionKey: newRedemptionKey(),
          expiresAt: Date.now() + (fragment.has('handoff') ? 60_000 : 7 * 86400_000),
        }
      : stored;
    const token = recovery?.token;
    if (!token && !pending.current) {
      setLoading(false);
      return;
    }
    if (!pending.current) {
      if (!recovery) return;
      writeMeetingLink(props.sessionId, recovery);
      setError(null);
      setLoading(true);
      // Remove the capability before rendering the SDK or loading third-party media.
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
      personal.current = recovery.personal;
      pending.current = createPublicApiClient(
        personal.current ? null : props.accessToken,
      ).post(`/live-sessions/${encodeURIComponent(props.sessionId)}/link-info`, {
        token,
        handoff: recovery.handoff,
        redemptionKey: recovery.redemptionKey,
      });
    }
    void pending.current
      .then((value) => {
        if (active) {
          if (recovery)
            writeMeetingLink(props.sessionId, {
              ...recovery,
              token: value.linkToken,
              handoff: false,
              expiresAt:
                recovery.personal && recovery.handoff
                  ? Date.now() + 4 * 3600_000
                  : recovery.expiresAt,
            });
          setResolved(value);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiHttpError && [400, 403, 404].includes(cause.status)
              ? 'This meeting link has expired or is no longer valid. Open the meeting again from the app or ask for a new invitation.'
              : 'Could not reach the meeting. Check your connection and try again.',
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [props.sessionId, props.accessToken, attempt]);
  if (loading) return <ZoomSessionLoadingScreen label="Opening meeting…" />;
  if (error)
    return (
      <div className="mx-auto max-w-lg p-6">
        <Alert>
          <AlertTitle>Unable to join</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          className="mt-4"
          onClick={() => {
            pending.current = null;
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            clearMeetingLink(props.sessionId);
            window.location.reload();
          }}
        >
          Use another way to join
        </Button>
      </div>
    );
  if (!resolved) return <LiveSessionSetup {...props} />;
  const info = resolved.info;
  if (!info.exists || !info.isActive)
    return (
      <Alert>
        <AlertTitle>Session has ended</AlertTitle>
      </Alert>
    );
  return (
    <LiveSessionSetup
      {...props}
      accessToken={personal.current ? null : props.accessToken}
      identityKey={resolved.linkToken}
      linkToken={resolved.linkToken}
      settings={info.settings}
      passcodeRequired={info.isHost ? false : (info.passcodeRequired ?? true)}
      initialCredentials={info.isHost ? info.hostJoin : null}
      initialPasscode={info.isHost ? info.hostJoin.passcode : null}
      participantName={
        info.isHost ? info.hostJoin.displayName : info.participant?.displayName
      }
      students={info.isHost ? undefined : info.participant?.students}
    />
  );
}
