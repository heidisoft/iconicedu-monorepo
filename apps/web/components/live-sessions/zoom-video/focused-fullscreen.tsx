'use client';

import { useEffect, useState } from 'react';
import { Maximize, Minimize, X } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';

/** Fullscreen the existing content node, keeping SDK media and board state mounted. */
export function useFocusedFullscreen(visible = true) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported =
    !!target &&
    typeof target.requestFullscreen === 'function' &&
    target.ownerDocument.fullscreenEnabled !== false;
  useEffect(() => {
    if (!target) return;
    const owner = target.ownerDocument;
    const update = () => setActive(owner.fullscreenElement === target);
    owner.addEventListener('fullscreenchange', update);
    update();
    return () => owner.removeEventListener('fullscreenchange', update);
  }, [target]);
  useEffect(() => {
    if (!visible && target && target.ownerDocument.fullscreenElement === target)
      void target.ownerDocument.exitFullscreen().catch(() => {});
  }, [visible, target]);
  const toggle = async () => {
    if (!target || !supported) return;
    setError(null);
    try {
      if (target.ownerDocument.fullscreenElement === target)
        await target.ownerDocument.exitFullscreen();
      else await target.requestFullscreen();
    } catch {
      setError('Unable to open fullscreen. Return to the main call and try again.');
    }
  };
  return {
    setTarget,
    active,
    supported,
    toggle,
    error,
    dismissError: () => setError(null),
  };
}

export function FocusedFullscreenButton({
  fullscreen,
  label,
  visible = true,
}: {
  fullscreen: ReturnType<typeof useFocusedFullscreen>;
  label: string;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        className="focused-fullscreen-control absolute right-3 bottom-3 z-40 shadow-sm"
        aria-label={fullscreen.active ? 'Exit fullscreen' : `View ${label} fullscreen`}
        aria-pressed={fullscreen.active}
        title={
          fullscreen.supported
            ? fullscreen.active
              ? 'Exit fullscreen (Esc)'
              : `View ${label} fullscreen`
            : 'Fullscreen is unavailable in this window. Return to the main call.'
        }
        disabled={!fullscreen.supported}
        onClick={() => void fullscreen.toggle()}
      >
        {fullscreen.active ? (
          <Minimize className="size-4" />
        ) : (
          <Maximize className="size-4" />
        )}
      </Button>
      {fullscreen.error && (
        <div
          role="alert"
          className="absolute right-3 bottom-14 z-40 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md border border-border bg-card p-2 text-sm shadow-sm"
        >
          {fullscreen.error}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss fullscreen error"
            onClick={fullscreen.dismissError}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </>
  );
}

export function FocusedFullscreenStyles() {
  return (
    <style>{`
    [data-focused-content]:fullscreen {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100dvh !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      transform: none !important;
      transition: none !important;
    }
    [data-focused-content]:fullscreen::backdrop { background: black; }
    [data-focused-content='video']:fullscreen { background: black; }
    [data-focused-content='video']:fullscreen video-player { object-fit: contain !important; }
    [data-focused-content='video']:fullscreen > [data-tile-overlay],
    [data-focused-content]:fullscreen [data-share-switcher],
    [data-focused-content]:fullscreen [data-testid='whiteboard-board-details'],
    [data-focused-content]:fullscreen [data-testid='whiteboard-overlay-toolbar'],
    [data-focused-content]:fullscreen .whiteboard-style-toggle,
    [data-focused-content]:fullscreen .excalidraw .App-menu_top,
    [data-focused-content]:fullscreen .excalidraw .App-mobile-menu,
    [data-focused-content]:fullscreen [data-whiteboard-hint] { display: none !important; }
  `}</style>
  );
}
