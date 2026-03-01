'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, LogOut, MonitorUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@iconicedu/ui-web/ui/button';
import {
  type DailyCallFrame,
  loadDailyJs,
} from '@iconicedu/web/lib/live-sessions/daily-js-browser';

export function DailyLiveSessionEmbed({
  joinUrl,
  returnPath,
}: {
  joinUrl: string;
  returnPath: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callFrameRef = useRef<DailyCallFrame | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    const setup = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        const DailyIframe = await loadDailyJs();
        if (!isActive || !containerRef.current) {
          return;
        }

        const callFrame = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: true,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
          },
        });

        callFrameRef.current = callFrame;
        callFrame.on('joined-meeting', () => {
          if (!isActive) return;
          setIsLoaded(true);
          setError(null);
        });
        callFrame.on('left-meeting', () => {
          if (!isActive) return;
          router.push(returnPath);
        });
        callFrame.on('error', (...args) => {
          if (!isActive) return;
          const first = args[0];
          const message =
            typeof first === 'object' && first && 'errorMsg' in first
              ? String((first as { errorMsg?: unknown }).errorMsg ?? 'Failed to join live session')
              : 'Failed to join live session';
          setError(message);
        });

        await callFrame.join({ url: joinUrl });
      } catch (setupError) {
        if (!isActive) return;
        setError(
          setupError instanceof Error
            ? setupError.message
            : 'Failed to load live session',
        );
      }
    };

    void setup();

    return () => {
      isActive = false;
      callFrameRef.current?.destroy();
      callFrameRef.current = null;
    };
  }, [joinUrl, returnPath, router]);

  const handleLeave = async () => {
    const callFrame = callFrameRef.current;
    if (!callFrame || isLeaving) {
      return;
    }

    setIsLeaving(true);
    try {
      await callFrame.leave();
    } catch {
      router.push(returnPath);
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={joinUrl} target="_blank" rel="noreferrer">
            <MonitorUp className="h-4 w-4" />
            Open in new tab
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={() => void handleLeave()}>
          {isLeaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          Leave
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-black">
        {!isLoaded && !error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading live session...
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 px-6 text-center">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Live session unavailable</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : null}
        <div ref={containerRef} className="h-full min-h-[70vh] w-full" />
      </div>
    </div>
  );
}
