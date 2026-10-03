'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Video, VideoOff } from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { cn, getInitials } from '@iconicedu/ui-web/lib/utils';

// Plain browser getUserMedia, independent of the Zoom Video SDK — lets
// someone check their camera/mic before the Zoom client ever initializes.
// This stream is stopped once they click Join; the Zoom SDK requests its own
// camera/mic access internally after that.
export function DevicePreviewStep({
  displayName,
  sessionTitle,
  onJoin,
}: {
  displayName: string;
  sessionTitle: string;
  onJoin: (preferences: { muted: boolean; videoOff: boolean }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
        setPermissionError(
          'Camera/microphone access was blocked. You can still join with them off and enable them later.',
        );
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !videoOff;
    });
  }, [videoOff]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, [muted]);

  const handleJoin = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onJoin({ muted, videoOff });
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-6 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{sessionTitle}</h1>
        <p className="text-sm text-muted-foreground">
          Check your camera and microphone before joining.
        </p>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting camera…
          </div>
        ) : null}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn('h-full w-full -scale-x-100 object-cover', videoOff && 'hidden')}
        />
        {!isLoading && videoOff ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-700 text-lg font-medium text-neutral-100">
              {getInitials(displayName)}
            </div>
          </div>
        ) : null}
        {permissionError ? (
          <p className="absolute inset-x-2 bottom-2 rounded-lg bg-black/70 px-2 py-1 text-center text-xs text-destructive-foreground">
            {permissionError}
          </p>
        ) : null}
      </div>

      <div className="flex w-full items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          aria-label={muted ? 'Turn microphone on' : 'Turn microphone off'}
          aria-pressed={!muted}
          onClick={() => setMuted((previous) => !previous)}
          disabled={isLoading && !permissionError}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {muted ? 'Mic off' : 'Mic on'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          aria-label={videoOff ? 'Turn camera on' : 'Turn camera off'}
          aria-pressed={!videoOff}
          onClick={() => setVideoOff((previous) => !previous)}
          disabled={isLoading && !permissionError}
        >
          {videoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          {videoOff ? 'Camera off' : 'Camera on'}
        </Button>
      </div>

      <Button type="button" className="w-full" onClick={handleJoin}>
        Join session
      </Button>
    </div>
  );
}
