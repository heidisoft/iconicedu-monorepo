'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { SessionCompletedTile } from '@iconicedu/ui-web/components/dashboard/session-completed-tile';

// How long the tile's own "Thank you" / "Reported" confirmation stays on screen
// before it advances. Without this pause, remove() fired in the same tick as that
// confirmation appearing, so React batched both updates together and the message
// never actually got painted — it looked like the tile just vanished.
const ADVANCE_DELAY_MS = 1400;

// How many cards deep the stack renders — the front (interactive) card plus this
// many peeking placeholders behind it.
const STACK_DEPTH = 2;

// Card-stack visual: only the front card is interactive, the rest peek out from
// behind it (decreasing scale/opacity, offset upward) like a physical deck. When
// the front card resolves, it holds its confirmation message briefly, then exits;
// every remaining card's depth shifts down one slot, and its `animate` scale/y/
// opacity values tween to their new depth automatically.
export function SessionCompletedCarousel({
  completions,
}: {
  completions: SessionCompletionVM[];
}) {
  const [visibleCompletions, setVisibleCompletions] = useState(completions);
  const pendingTimeouts = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setVisibleCompletions(completions);
  }, [completions]);

  useEffect(() => {
    const timeouts = pendingTimeouts.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const scheduleRemove = (id: string) => {
    const timeout = setTimeout(() => {
      pendingTimeouts.current.delete(timeout);
      setVisibleCompletions((current) => current.filter((item) => item.id !== id));
    }, ADVANCE_DELAY_MS);
    pendingTimeouts.current.add(timeout);
  };

  const current = visibleCompletions[0] ?? null;
  const stack = visibleCompletions.slice(0, STACK_DEPTH + 1);

  return (
    <AnimatePresence initial={false}>
      {current ? (
        <motion.section
          key="session-completed-section"
          aria-labelledby="session-completed-heading"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="mb-6 overflow-hidden"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="session-completed-heading" className="font-semibold tracking-tight">
              Recently completed
            </h2>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {visibleCompletions.length}
            </span>
          </div>

          <div className="relative">
            <AnimatePresence initial={false}>
              {stack.map((item, depth) => {
                const position: 'relative' | 'absolute' =
                  depth === 0 ? 'relative' : 'absolute';
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 1 - depth * 0.05, y: 24 }}
                    animate={{
                      opacity: 1 - depth * 0.35,
                      scale: 1 - depth * 0.05,
                      y: depth * -10,
                    }}
                    exit={{ opacity: 0, scale: 0.92, y: -20 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    style={{
                      zIndex: stack.length - depth,
                      pointerEvents: depth === 0 ? 'auto' : 'none',
                      position,
                      inset: depth === 0 ? undefined : 0,
                    }}
                  >
                    {depth === 0 ? (
                      <SessionCompletedTile
                        completion={item}
                        onVoteSubmit={(status) => {
                          if (status === 'disputed') scheduleRemove(item.id);
                        }}
                        onRatingSubmit={() => scheduleRemove(item.id)}
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="h-full w-full rounded-xl border border-border/40 bg-muted/30"
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
