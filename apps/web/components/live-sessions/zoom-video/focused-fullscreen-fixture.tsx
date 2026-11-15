'use client';

import { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useFixtureAnnotations } from '../../screen-annotations/annotation-visual-fixture';

const AnnotationOverlay = dynamic(
  () =>
    import('../../screen-annotations/annotation-overlay').then(
      (module) => module.AnnotationOverlay,
    ),
  { ssr: false },
);
import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomShareStage } from './zoom-share-stage';
import { ZoomShareFilmstrip } from './zoom-share-filmstrip';

/** Synthetic renderer fixture; never available in production. */
export function FocusedFullscreenFixture() {
  const [content, setContent] = useState<'remote' | 'local' | 'whiteboard' | 'none'>(
    'remote',
  );
  const remote = useRef<HTMLCanvasElement>(null);
  const local = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const participant = useRef<HTMLDivElement>(null);
  const remoteParticipants = useRef(new Map<number, HTMLDivElement>());
  const [speaker, setSpeaker] = useState(2);
  const attachPlayers = useCallback(() => {
    for (const surface of [participant.current, ...remoteParticipants.current.values()]) {
      if (surface && !surface.querySelector('video-player')) {
        const player = document.createElement('video-player');
        player.dataset.identity = 'retained-camera';
        surface.appendChild(player);
      }
    }
  }, []);
  return (
    <TooltipProvider>
      <main className="fixed inset-0 bg-background text-foreground">
        <div className="relative z-20 flex gap-3 p-2" data-testid="call-navigation">
          {(['remote', 'local', 'whiteboard', 'none'] as const).map((value) => (
            <button key={value} onClick={() => setContent(value)}>
              Show {value}
            </button>
          ))}
        </div>
        <button className="relative z-20" onClick={() => setSpeaker(3)}>
          Change speaker
        </button>
        <ZoomShareStage
          remoteCanvasRef={remote}
          localCanvasRef={local}
          localVideoRef={video}
          whiteboardContainerRef={board}
          dimensions={{ width: 1280, height: 720 }}
          showRemoteShare={content === 'remote'}
          showLocalShare={content === 'local'}
          showWhiteboard={content === 'whiteboard'}
          whiteboardLoading={false}
          localRenderTarget="canvas"
          sidebarOpen={false}
          sharePresenters={[
            { userId: 1, displayName: 'Presenter one' },
            { userId: 2, displayName: 'Presenter two' },
          ]}
          activeShareUserId={1}
          onSelectShare={() => {}}
          annotationOverlay={(size) => (
            <AnnotationOverlay
              {...size}
              presenting
              sessionId="fullscreen-fixture"
              shareKey="1"
              useAnnotations={useFixtureAnnotations}
            />
          )}
          whiteboardContent={
            <div className="relative h-full bg-card">
              <div data-testid="whiteboard-board-details">
                Board name · Saved · People
              </div>
              <div data-testid="whiteboard-overlay-toolbar">Drawing tools</div>
              <input aria-label="Whiteboard draft" defaultValue="Unchanged drawing" />
              <svg
                data-testid="live-whiteboard"
                viewBox="0 0 320 180"
                className="h-full w-full"
              >
                <path
                  d="M20 120L160 30L300 120"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                />
              </svg>
            </div>
          }
        />
        <div
          className="absolute bottom-0 left-0 h-32 w-48"
          data-testid="participant-strip"
        >
          <ZoomShareFilmstrip
            displayName="Self"
            selfMuted={false}
            selfVideoOn
            selfHandRaised={false}
            selfVideoRef={participant}
            remoteParticipants={[
              {
                userId: 2,
                displayName: 'Speaker one',
                muted: false,
                bVideoOn: true,
                isHost: false,
              },
              {
                userId: 3,
                displayName: 'Speaker two',
                muted: false,
                bVideoOn: true,
                isHost: false,
              },
            ]}
            raisedHandUserIds={new Set()}
            activeSpeakerUserId={speaker}
            selfUserId={1}
            sidebarOpen={false}
            onReady={attachPlayers}
            onRemoteContainer={(id, node) => {
              if (node) remoteParticipants.current.set(id, node);
              else remoteParticipants.current.delete(id);
            }}
          />
        </div>
      </main>
    </TooltipProvider>
  );
}
