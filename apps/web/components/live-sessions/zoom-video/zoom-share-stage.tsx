'use client';

import type { Ref } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@iconicedu/ui-web/lib/utils';

type ShareDimensions = {
  width: number;
  height: number;
};

const shareStageClassName =
  'zoom-share-stage absolute inset-x-4 bottom-44 top-20 flex items-center justify-center overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border/60 transition-[inset,opacity] duration-300 ease-out motion-reduce:transition-none sm:inset-x-6 sm:bottom-52 sm:top-24 lg:bottom-32';

export function ZoomShareStage({
  remoteCanvasRef,
  localCanvasRef,
  localVideoRef,
  whiteboardContainerRef,
  dimensions,
  showRemoteShare,
  showLocalShare,
  showWhiteboard,
  whiteboardLoading,
  localRenderTarget,
  sidebarOpen,
  sharePresenters,
  activeShareUserId,
  onSelectShare,
}: {
  remoteCanvasRef: Ref<HTMLCanvasElement>;
  localCanvasRef: Ref<HTMLCanvasElement>;
  localVideoRef: Ref<HTMLVideoElement>;
  whiteboardContainerRef: Ref<HTMLDivElement>;
  dimensions: ShareDimensions;
  showRemoteShare: boolean;
  showLocalShare: boolean;
  showWhiteboard: boolean;
  whiteboardLoading: boolean;
  localRenderTarget: 'canvas' | 'video';
  sidebarOpen: boolean;
  sharePresenters: Array<{ userId: number; displayName: string }>;
  activeShareUserId: number | null;
  onSelectShare: (userId: number) => void;
}) {
  const aspectRatio = `${dimensions.width} / ${dimensions.height}`;

  const shareSwitcher =
    sharePresenters.length > 1 ? (
      <div
        role="tablist"
        aria-label="Shared screens"
        className="absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full bg-background/90 p-1 shadow-md ring-1 ring-border backdrop-blur"
      >
        {sharePresenters.map((presenter) => (
          <button
            key={presenter.userId}
            type="button"
            role="tab"
            aria-selected={activeShareUserId === presenter.userId}
            className={cn(
              'min-h-9 max-w-40 shrink-0 truncate rounded-full px-3 text-xs font-medium transition-colors',
              activeShareUserId === presenter.userId
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
            onClick={() => onSelectShare(presenter.userId)}
          >
            {presenter.displayName}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div
        className={cn(
          shareStageClassName,
          showRemoteShare ? 'opacity-100' : 'pointer-events-none opacity-0',
          sidebarOpen && 'zoom-share-stage-panel',
        )}
        aria-hidden={!showRemoteShare}
      >
        {shareSwitcher}
        <canvas
          ref={remoteCanvasRef}
          className="block h-auto w-full max-h-full max-w-full object-contain"
          style={{ aspectRatio }}
        />
      </div>

      {/* Zoom selects the local canvas or video renderer by browser capability.
          Both targets must remain mounted and measurable while sharing. */}
      <div
        className={cn(
          shareStageClassName,
          'z-10',
          showLocalShare ? 'opacity-100' : 'pointer-events-none opacity-0',
          sidebarOpen && 'zoom-share-stage-panel',
        )}
        aria-hidden={!showLocalShare}
      >
        {shareSwitcher}
        <canvas
          ref={localCanvasRef}
          className={cn(
            'absolute h-auto w-full max-h-full max-w-full object-contain',
            localRenderTarget === 'canvas' ? 'opacity-100' : 'opacity-0',
          )}
          style={{ aspectRatio }}
        />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'absolute h-full w-full object-contain',
            localRenderTarget === 'video' ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>

      <div
        className={cn(
          shareStageClassName,
          'block bg-background',
          showWhiteboard ? 'opacity-100' : 'pointer-events-none opacity-0',
          sidebarOpen && 'zoom-share-stage-panel',
        )}
        aria-hidden={!showWhiteboard}
      >
        {/* Zoom requires an empty mounting element; keep loading UI in the
            wrapper so the SDK owns this child exclusively. */}
        <div ref={whiteboardContainerRef} className="absolute inset-0" />
        {whiteboardLoading ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-border">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Opening whiteboard…
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
