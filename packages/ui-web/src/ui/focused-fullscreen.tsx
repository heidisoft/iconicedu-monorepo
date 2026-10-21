'use client';

import { createContext, useEffect, useState } from 'react';
import { Fullscreen, Minimize } from 'lucide-react';
import { NotificationCard } from './notification-card';
import { Button } from './button';

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

export const FocusedContentFullscreenContext = createContext<ReturnType<
  typeof useFocusedFullscreen
> | null>(null);

export function FocusedFullscreenButton({
  fullscreen,
  label,
  visible = true,
  inline = false,
}: {
  fullscreen: ReturnType<typeof useFocusedFullscreen>;
  label: string;
  visible?: boolean;
  inline?: boolean;
}) {
  if (!visible) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        className={
          inline
            ? 'focused-fullscreen-control size-11 shrink-0 rounded-full'
            : 'focused-fullscreen-control absolute right-3 bottom-3 z-40 size-11 shadow-sm'
        }
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
          <Fullscreen className="size-4" />
        )}
      </Button>
      {fullscreen.error && (
        <NotificationCard
          role="alert"
          message={fullscreen.error}
          className="absolute right-3 bottom-14 z-40 w-[calc(100%-1.5rem)]"
          dismissLabel="Dismiss fullscreen error"
          onDismiss={fullscreen.dismissError}
        />
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
    [data-focused-content]:fullscreen [data-whiteboard-hint] { display: none !important; }
  `}</style>
  );
}
