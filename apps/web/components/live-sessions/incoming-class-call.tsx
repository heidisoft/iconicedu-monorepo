'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';
import type { ClassroomCallVM } from '@iconicedu/shared-types';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createClassroomCallsApi } from '@iconicedu/web/lib/api/classroom-calls';
export function IncomingClassCall() {
  const api = useMemo(() => createClassroomCallsApi(createSupabaseBrowserClient()), []);
  const router = useRouter();
  const [call, setCall] = useState<ClassroomCallVM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'accepted' | 'declined' | 'message' | null>(
    null,
  );
  const busy = useRef(false);
  const dismissed = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        const value = await api.incoming();
        for (const item of value)
          if (dismissed.current.has(item.id))
            void api.respond(item.id, 'declined').catch(() => {});
        if (active)
          setCall(value.find((item) => !dismissed.current.has(item.id)) ?? null);
      } catch {
        /* Keep a displayed invitation only until its expiry. */
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [api]);
  useEffect(() => {
    setError(null);
    if (!call) return;
    const sound = new Audio('/classroom-ring.wav');
    sound.loop = true;
    void sound.play().catch(() => {
      /* Browser autoplay permission may require interaction. */
    });
    const timer = setTimeout(
      () => setCall(null),
      Math.max(0, Date.parse(call.expiresAt) - Date.now()),
    );
    return () => {
      clearTimeout(timer);
      sound.pause();
    };
  }, [call?.id]);
  const respond = async (action: 'accepted' | 'declined') => {
    if (!call || busy.current) return;
    busy.current = true;
    const invitation = call;
    if (action === 'declined') {
      if (dismissed.current.size >= 1000) dismissed.current.clear();
      dismissed.current.add(invitation.id);
      setCall(null);
    }
    setPending(action);
    setError(null);
    try {
      const result = await api.respond(invitation.id, action);
      setCall(null);
      if (action === 'accepted')
        router.push(`/live/${encodeURIComponent(result.sessionId)}`);
    } catch (e) {
      if (action === 'accepted')
        setError(e instanceof Error ? e.message : 'Unable to answer this invitation.');
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  const message = async () => {
    if (!call || busy.current) return;
    busy.current = true;
    setPending('message');
    setError(null);
    try {
      const result = await api.messageTutor(call.id);
      dismissed.current.add(call.id);
      setCall(null);
      router.push(result.webPath);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to open your tutor conversation.',
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  };
  return (
    <Dialog
      open={!!call}
      onOpenChange={(open) => {
        if (!open) void respond('declined');
      }}
    >
      <DialogContent className="max-w-sm rounded-3xl p-7">
        <DialogHeader className="items-center gap-3 text-center">
          <Phone className="size-8" />
          <p className="text-sm text-muted-foreground">Incoming class call</p>
          <DialogTitle>{call?.callerName}</DialogTitle>
          <DialogDescription>
            {call?.classTitle}. Join opens the class preview.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-center gap-4">
          <Button
            variant="secondary"
            disabled={!!pending}
            onClick={() => {
              void respond('declined');
            }}
          >
            <PhoneOff />
            Decline
          </Button>
          <Button
            disabled={!!pending}
            onClick={() => {
              void respond('accepted');
            }}
          >
            <Phone />
            {pending === 'accepted' ? 'Connecting…' : 'Join'}
          </Button>
        </div>
        {call?.messageAvailable && (
          <Button
            variant="ghost"
            disabled={!!pending}
            onClick={() => {
              void message();
            }}
          >
            <MessageCircle />
            {pending === 'message' ? 'Opening…' : 'Message tutor'}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
