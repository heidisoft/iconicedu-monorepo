'use client';

import { useEffect, useRef, useState } from 'react';
import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import type { ZoomClient } from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { attachCameraTile, detachCameraTile } from './zoom-video-media';
import { ZoomVideoTile } from './zoom-video-tile';

// Synthetic SDK renderer; exercise the production adapter and tile without
// hardware, credentials, or network calls to Zoom.
export function ZoomMediaFixture() {
  const self = useRef<HTMLDivElement>(null);
  const remote = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [ready, setReady] = useState(false);
  const [client] = useState(
    () =>
      ({
        getMediaStream: () => ({
          attachVideo: async (_id: number, _quality: number, existing?: HTMLElement) => {
            const element = existing ?? document.createElement('video-player');
            element.textContent = 'Synthetic camera frame';
            return element;
          },
          detachVideo: async () => undefined,
        }),
      }) as unknown as ZoomClient,
  );

  useEffect(() => {
    async function synchronize() {
      if (!self.current || !remote.current) return;
      // Repeat the requests produced by SDK events and state effects.
      if (camera) {
        await Promise.all([
          attachCameraTile(client, 1, self.current),
          attachCameraTile(client, 1, self.current),
        ]);
      } else {
        await detachCameraTile(client, 1, self.current);
      }
      await attachCameraTile(client, 2, remote.current);
      setReady(true);
    }
    void synchronize();
  }, [camera, muted, client]);

  return (
    <TooltipProvider>
      <main data-ready={ready}>
        <button onClick={() => setMuted((value) => !value)}>Toggle microphone</button>
        <button onClick={() => setCamera((value) => !value)}>Toggle camera</button>
        <div className="grid h-80 grid-cols-2">
          <div data-testid="self">
            <ZoomVideoTile
              label="Self"
              isSelf
              isMuted={muted}
              isVideoOn={camera}
              videoContainerRef={self}
            />
          </div>
          <div data-testid="remote">
            <ZoomVideoTile
              label="Remote"
              isSelf={false}
              isMuted={false}
              isVideoOn
              videoContainerRef={remote}
            />
          </div>
        </div>
      </main>
    </TooltipProvider>
  );
}
