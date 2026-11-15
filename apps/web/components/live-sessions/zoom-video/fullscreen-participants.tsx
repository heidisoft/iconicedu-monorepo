'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, Users, UserRound, X } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';

/** Move one stable portal host: Zoom's existing players and React refs stay mounted. */
export function FullscreenParticipants({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady?: () => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const [selfShown, setSelfShown] = useState(true);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const element = document.createElement('div');
    element.className = 'contents';
    setHost(element);
    return () => element.remove();
  }, []);
  useLayoutEffect(() => {
    if (!host) return;
    const update = () => {
      const fullscreen = host.ownerDocument.fullscreenElement;
      const next =
        fullscreen instanceof HTMLElement &&
        ['share', 'whiteboard'].includes(fullscreen.dataset.focusedContent ?? '')
          ? fullscreen
          : null;
      (next ?? anchor.current)?.appendChild(host);
      host.className = next ? 'pointer-events-none absolute inset-0 z-50' : 'contents';
      host.dataset.fullscreenParticipants = String(!!next);
      setTarget(next);
      setPosition(null);
      drag.current = null;
      if (!next) setShown(false);
    };
    const owner = host.ownerDocument;
    owner.addEventListener('fullscreenchange', update);
    update();
    return () => {
      owner.removeEventListener('fullscreenchange', update);
      host.remove();
    };
  }, [host]);
  useEffect(() => {
    if (host) onReady?.();
  }, [host, onReady]);

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(
        12,
        Math.min(x, (target?.clientWidth ?? 0) - (panel.current?.offsetWidth ?? 0) - 12),
      ),
      y: Math.max(
        12,
        Math.min(
          y,
          (target?.clientHeight ?? 0) - (panel.current?.offsetHeight ?? 0) - 56,
        ),
      ),
    }),
    [target],
  );
  const positioned = position !== null;
  useEffect(() => {
    if (!target || !positioned) return;
    const observer = new ResizeObserver(() => {
      setPosition((current) => current && clamp(current.x, current.y));
    });
    observer.observe(target);
    if (panel.current) observer.observe(panel.current);
    return () => observer.disconnect();
  }, [target, positioned, clamp]);

  return (
    <>
      <div ref={anchor} className="contents" />
      {host &&
        createPortal(
          <>
            <style>{`
            [data-fullscreen-participants='true'] .zoom-filmstrip {
              position: static !important; inset: auto !important; width: 100% !important; height: auto !important;
              display: flex !important; flex-direction: column !important; gap: 6px;
              max-height: calc(100dvh - 160px); overflow: auto !important; animation: none !important;
            }
            [data-fullscreen-participants='true'] .zoom-video-tile-filmstrip {
              width: 100% !important; height: auto !important; min-width: 0 !important; flex-shrink: 0; border-radius: 12px;
            }
            [data-fullscreen-participants='true'] .zoom-video-tile-filmstrip > div[data-tile-overlay] { right: 8px !important; }
            [data-fullscreen-participants='true'] .zoom-video-tile-filmstrip:not([data-fullscreen-featured='true']):not([data-self-video='true']),
            [data-fullscreen-participants='true'][data-hide-self='true'] [data-self-video='true'],
            [data-fullscreen-participants='true'] .focused-fullscreen-control { display: none !important; }
          `}</style>
            {target && (
              <Button
                ref={toggle}
                variant="secondary"
                size="sm"
                className="pointer-events-auto absolute bottom-3 left-3 rounded-full shadow-sm"
                aria-expanded={shown}
                aria-controls="fullscreen-participant-videos"
                onClick={() => setShown((value) => !value)}
              >
                <Users className="size-4" />
                {shown ? 'Hide participants' : 'Show participants'}
              </Button>
            )}
            <div
              ref={panel}
              id="fullscreen-participant-videos"
              role={target ? 'region' : undefined}
              aria-label={target ? 'Fullscreen participants' : undefined}
              aria-hidden={target ? !shown : undefined}
              className={
                target
                  ? 'pointer-events-auto absolute w-44 max-w-[calc(100%-24px)] rounded-2xl border border-border bg-card/95 p-1.5 text-card-foreground shadow-md backdrop-blur-sm'
                  : 'contents'
              }
              style={
                target
                  ? {
                      visibility: shown ? 'visible' : 'hidden',
                      ...(position
                        ? { left: position.x, top: position.y }
                        : { right: 12, bottom: 64 }),
                    }
                  : undefined
              }
            >
              {target && (
                <div className="mb-1 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move participant videos"
                    title="Drag to move, or use arrow keys"
                    className="flex h-7 flex-1 touch-none cursor-grab items-center justify-center rounded-full text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
                    onPointerDown={(event) => {
                      if (event.button !== 0 || !panel.current) return;
                      const bounds = panel.current.getBoundingClientRect();
                      const parent = target.getBoundingClientRect();
                      drag.current = {
                        x: event.clientX,
                        y: event.clientY,
                        left: bounds.left - parent.left,
                        top: bounds.top - parent.top,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const start = drag.current;
                      if (start)
                        setPosition(
                          clamp(
                            start.left + event.clientX - start.x,
                            start.top + event.clientY - start.y,
                          ),
                        );
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    onLostPointerCapture={() => {
                      drag.current = null;
                    }}
                    onKeyDown={(event) => {
                      const delta = {
                        ArrowLeft: [-16, 0],
                        ArrowRight: [16, 0],
                        ArrowUp: [0, -16],
                        ArrowDown: [0, 16],
                      }[event.key];
                      if (!delta || !panel.current) return;
                      event.preventDefault();
                      const bounds = panel.current.getBoundingClientRect();
                      const parent = target.getBoundingClientRect();
                      setPosition(
                        clamp(
                          bounds.left - parent.left + delta[0],
                          bounds.top - parent.top + delta[1],
                        ),
                      );
                    }}
                  >
                    <GripHorizontal className="size-4" />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 rounded-full"
                    aria-label={selfShown ? 'Hide self-view' : 'Show self-view'}
                    aria-pressed={selfShown}
                    onClick={() => {
                      host.dataset.hideSelf = String(selfShown);
                      setSelfShown((value) => !value);
                    }}
                  >
                    <UserRound className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 rounded-full"
                    aria-label="Hide participant videos"
                    onClick={() => {
                      setShown(false);
                      toggle.current?.focus();
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
              {children}
            </div>
          </>,
          host,
        )}
    </>
  );
}
