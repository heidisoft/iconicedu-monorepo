'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, PhoneMissed, Video } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import type { ClassroomCallVM } from '@iconicedu/shared-types';
import { createClassroomCallsApi } from '@iconicedu/web/lib/api/classroom-calls';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
export function ClassroomCallDetails({ callId }: { callId: string }) {
  const api = useMemo(() => createClassroomCallsApi(createSupabaseBrowserClient()), []);
  const router = useRouter();
  const [call, setCall] = useState<ClassroomCallVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void api
      .detail(callId)
      .then((value) => {
        if (active) setCall(value);
      })
      .catch(() => {
        if (active)
          setError(
            'Unable to load this call. Check your connection or classroom access.',
          );
      });
    return () => {
      active = false;
    };
  }, [api, callId, attempt]);
  const action = async (kind: 'join' | 'message') => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (kind === 'join') {
        const result = await api.joinMissed(callId);
        router.push(`/live/${encodeURIComponent(result.sessionId)}`);
      } else {
        const result = await api.messageTutor(callId);
        router.push(result.webPath);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open this action.');
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-7">
        <PhoneMissed className="size-8" />
        <h1 className="text-2xl font-semibold">
          {call?.status === 'expired' ? 'Missed call' : 'Class call'}
        </h1>
        {call ? (
          <>
            <p className="text-lg">From {call.callerName}</p>
            <p className="text-muted-foreground">{call.classTitle}</p>
            <div className="flex flex-col gap-3">
              <Button
                disabled={pending || !call.canJoin}
                onClick={() => {
                  void action('join');
                }}
              >
                <Video />
                Join classroom
              </Button>
              {!call.canJoin && (
                <p className="text-xs text-muted-foreground">
                  {call.joinUnavailableReason ??
                    'The class is not currently in its scheduled time.'}
                </p>
              )}
              <Button
                variant="secondary"
                disabled={pending || !call.messageAvailable}
                onClick={() => {
                  void action('message');
                }}
              >
                <MessageCircle />
                Message tutor
              </Button>
              {!call.messageAvailable && (
                <p className="text-xs text-muted-foreground">
                  Messaging is not available for this conversation.
                </p>
              )}
            </div>
          </>
        ) : (
          !error && <p role="status">Loading call…</p>
        )}
        {error && (
          <>
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
              Retry
            </Button>
          </>
        )}
      </section>
    </main>
  );
}
