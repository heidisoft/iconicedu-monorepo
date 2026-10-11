'use client';

import { useRef, useState } from 'react';
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
import { ZoomVideoTile } from './zoom-video-tile';

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
          <ZoomVideoTile
            label="Other participant"
            isSelf={false}
            isMuted
            isVideoOn={false}
            videoContainerRef={participant}
          />
        </div>
      </main>
    </TooltipProvider>
  );
}
