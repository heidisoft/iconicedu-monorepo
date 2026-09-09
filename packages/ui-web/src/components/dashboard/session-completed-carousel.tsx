'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { reportObservedError } from '@iconicedu/utils';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { SessionCompletedTile } from '@iconicedu/ui-web/components/dashboard/session-completed-tile';

// How long the tile's own "Thank you" / "Reported" confirmation stays on screen
// before it advances. Without this pause, remove() fired in the same tick as that
// confirmation appearing, so React batched both updates together and the message
// never actually got painted — it looked like the tile just vanished.
const ADVANCE_DELAY_MS = 1400;

// After a bare confirm (no rating yet) the card is not removed — it holds up
// front for this long so the viewer still has a moment to add a rating, then it
// rotates to the BACK of the deck and comes around again later. Submitting a
// rating in the meantime resolves it and removes it as usual.
const VOTE_GRACE_MS = 8000;

// How many cards deep the stack renders — the front (interactive) card plus this
// many peeking placeholders behind it.
const STACK_DEPTH = 2;

// A session that's already confirmed and just waiting on a rating is lower
// priority than one that still needs a confirm/dispute decision — so it sinks to
// the bottom of the deck, keeping the actionable cards up front.
function isAwaitingVote(completion: SessionCompletionVM): boolean {
  return (
    (completion.status === 'confirmed' || completion.status === 'auto_confirmed') &&
    completion.rating == null
  );
}

// Stable partition: everything that still needs a decision first (original
// order), the confirmed-but-unrated cards after (original order).
function orderForStack(completions: SessionCompletionVM[]): SessionCompletionVM[] {
  const needsDecision: SessionCompletionVM[] = [];
  const awaitingVote: SessionCompletionVM[] = [];
  for (const completion of completions) {
    (isAwaitingVote(completion) ? awaitingVote : needsDecision).push(completion);
  }
  return [...needsDecision, ...awaitingVote];
}

// Fold the latest server list into what's on screen WITHOUT discarding the
// viewer's local arrangement. The parent can hand us a fresh array instance on
// every render, so a plain `setVisibleCompletions(orderForStack(...))` in the
// sync effect would resurrect a card the moment it was closed or sent to the
// back. Instead: keep the on-screen cards in their current order (refreshed with
// new data), drop any that vanished or were dismissed, append genuine newcomers,
// then re-run the partition.
function mergeStack(
  prev: SessionCompletionVM[],
  incoming: SessionCompletionVM[],
  dismissedIds: Set<string>,
): SessionCompletionVM[] {
  const incomingById = new Map(incoming.map((completion) => [completion.id, completion]));
  const merged: SessionCompletionVM[] = [];
  const seen = new Set<string>();

  for (const item of prev) {
    const fresh = incomingById.get(item.id);
    if (fresh && !dismissedIds.has(item.id)) {
      merged.push(fresh);
      seen.add(item.id);
    }
  }
  for (const item of incoming) {
    if (!seen.has(item.id) && !dismissedIds.has(item.id)) {
      merged.push(item);
    }
  }
  return orderForStack(merged);
}

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
  const [visibleCompletions, setVisibleCompletions] = useState(() =>
    orderForStack(completions),
  );
  const pendingTimeouts = useRef(new Set<ReturnType<typeof setTimeout>>());
  // Per-card "grace" timers (confirm → rotate to back) kept separately so a
  // later rating can cancel the pending rotate and remove the card instead.
  const graceTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Cards the viewer has closed — remembered so a re-fetch can't bring them back.
  const dismissedIds = useRef(new Set<string>());

  useEffect(() => {
    setVisibleCompletions((prev) => mergeStack(prev, completions, dismissedIds.current));
  }, [completions]);

  useEffect(() => {
    const timeouts = pendingTimeouts.current;
    const graces = graceTimeouts.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
      graces.forEach((timeout) => clearTimeout(timeout));
      graces.clear();
    };
  }, []);

  const clearGrace = (id: string) => {
    const timeout = graceTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      graceTimeouts.current.delete(id);
    }
  };

  const scheduleRemove = (id: string) => {
    clearGrace(id);
    const timeout = setTimeout(() => {
      pendingTimeouts.current.delete(timeout);
      setVisibleCompletions((current) => current.filter((item) => item.id !== id));
    }, ADVANCE_DELAY_MS);
    pendingTimeouts.current.add(timeout);
  };

  // Manual close (×) on a confirmed card — the viewer is done with it without
  // leaving a rating. Drop it locally right away, remember the id so an in-flight
  // re-fetch can't slot it back in, and tell the server (skip-rating stamps
  // rated_at with no rating) so it stays gone on the next load / other devices.
  const dismiss = (completion: SessionCompletionVM) => {
    clearGrace(completion.id);
    dismissedIds.current.add(completion.id);
    setVisibleCompletions((current) =>
      current.filter((item) => item.id !== completion.id),
    );
    void fetch(`/api/session-completions/${completion.id}/skip-rating`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: completion.orgId }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`skip-rating failed (${response.status})`);
      })
      .catch((error: unknown) => {
        reportObservedError({
          error,
          source: 'web.dashboard.session_completed_carousel.dismiss',
          message: 'Failed to skip rating for a dismissed session completion',
          context: { sessionCompletionId: completion.id },
        });
      });
  };

  const scheduleSendToBack = (id: string) => {
    clearGrace(id);
    const timeout = setTimeout(() => {
      graceTimeouts.current.delete(id);
      setVisibleCompletions((current) => {
        if (current.length < 2) return current;
        const index = current.findIndex((item) => item.id === id);
        if (index < 0) return current;
        const next = [...current];
        const [moved] = next.splice(index, 1);
        next.push(moved);
        return next;
      });
    }, VOTE_GRACE_MS);
    graceTimeouts.current.set(id, timeout);
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
                          else scheduleSendToBack(item.id);
                        }}
                        onRatingSubmit={() => scheduleRemove(item.id)}
                        onDismiss={() => dismiss(item)}
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
