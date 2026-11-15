'use client';
import { useEffect, useState } from 'react';
import { subscribeMeetingDeviceRecovery } from '@iconicedu/web/lib/live-sessions/browser-device-recovery';
import type { MeetingWaitingParticipantVM } from '@iconicedu/shared-types';
import { createPublicApiClient } from '@iconicedu/web/lib/api/http-client';
import { Alert, AlertDescription } from '@iconicedu/ui-web/ui/alert';
import { Button } from '@iconicedu/ui-web/ui/button';
/** Approval is enforced by apps/api before issuing any provider credential. */
export function MeetingWaitingRoom({
  sessionId,
  accessToken,
  linkToken,
}: {
  sessionId: string;
  accessToken?: string | null;
  linkToken?: string;
}) {
  const [requests, setRequests] = useState<MeetingWaitingParticipantVM[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let loading = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const value = await createPublicApiClient(accessToken).post<
          MeetingWaitingParticipantVM[]
        >(`/live-sessions/${encodeURIComponent(sessionId)}/waiting-room`, { linkToken });
        if (active) {
          setRequests(value);
          setError(null);
        }
      } catch {
        if (active) setError('Could not refresh the waiting room. Retrying…');
      }
      loading = false;
      if (active) timer = setTimeout(() => void load(), 4000);
    };
    void load();
    const stopResume = subscribeMeetingDeviceRecovery(() => {
      clearTimeout(timer);
      void load();
    });
    return () => {
      stopResume();
      active = false;
      clearTimeout(timer);
    };
  }, [sessionId, accessToken, linkToken]);
  const decide = async (id: string, approved: boolean) => {
    setBusy(id);
    try {
      await createPublicApiClient(accessToken).post(
        `/live-sessions/${encodeURIComponent(sessionId)}/waiting-room`,
        { linkToken, id, approved },
      );
      setRequests((items) => items.filter((item) => item.id !== id));
      setError(null);
    } catch {
      setError('Could not update this request. Try again.');
    } finally {
      setBusy(null);
    }
  };
  if (!requests.length && !error) return null;
  return (
    <section
      aria-label="Waiting room"
      className="rounded-xl border border-border bg-background p-3"
    >
      <h2 className="text-sm font-medium">Waiting room ({requests.length})</h2>
      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {requests.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className="min-w-0 flex-1 break-words text-sm">{item.displayName}</span>
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => void decide(item.id, true)}
          >
            Admit {item.displayName}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void decide(item.id, false)}
          >
            Decline {item.displayName}
          </Button>
        </div>
      ))}
    </section>
  );
}
