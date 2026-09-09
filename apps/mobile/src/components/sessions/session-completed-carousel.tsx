import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import { skipSessionCompletionRating } from '@/lib/api/session-completions';
import { reportMobileObservedError } from '@/lib/analytics/report-error';
import { SessionCompletedTile } from '@/components/sessions/session-completed-tile';

// How long the tile's own "Thank you" / "Reported" confirmation stays on screen
// before it advances — mirrors the web carousel (session-completed-carousel.tsx in
// packages/ui-web). Without this pause, scheduling removal in the same tick as the
// confirmation appearing meant the confirmation never actually got seen.
const ADVANCE_DELAY_MS = 1400;

// After a bare confirm (no rating yet) the card is not removed — it holds up
// front for this long so the viewer still has a moment to add a rating, then it
// rotates to the BACK of the deck and comes around again later. Submitting a
// rating in the meantime resolves it and removes it as usual. Mirrors the web
// carousel.
const VOTE_GRACE_MS = 8000;

// How many cards deep the stack renders — the front (interactive) card plus this
// many peeking placeholders behind it. Matches the web card-stack depth.
const STACK_DEPTH = 2;

// A session that's already confirmed and just waiting on a rating is lower
// priority than one that still needs a confirm/dispute decision — so it sinks to
// the bottom of the deck, keeping the actionable cards up front. Mirrors the web
// carousel (packages/ui-web/src/components/dashboard/session-completed-carousel.tsx).
function isAwaitingVote(session: SessionCompletionVM): boolean {
  return (
    (session.status === 'confirmed' || session.status === 'auto_confirmed') &&
    session.rating == null
  );
}

// Stable partition: everything that still needs a decision first (original
// order), the confirmed-but-unrated cards after (original order).
function orderForStack(sessions: SessionCompletionVM[]): SessionCompletionVM[] {
  const needsDecision: SessionCompletionVM[] = [];
  const awaitingVote: SessionCompletionVM[] = [];
  for (const session of sessions) {
    (isAwaitingVote(session) ? awaitingVote : needsDecision).push(session);
  }
  return [...needsDecision, ...awaitingVote];
}

// Fold the latest server list into what's on screen WITHOUT discarding the
// viewer's local arrangement. `useCompletedSessions` returns a fresh array
// instance on every render, so a plain `setVisibleSessions(orderForStack(...))`
// in the sync effect would fire constantly and resurrect a card the moment it
// was closed or sent to the back. Instead: keep the on-screen cards in their
// current order (refreshed with new data), drop any that vanished or were
// dismissed, append genuine newcomers, then re-run the partition.
function mergeStack(
  prev: SessionCompletionVM[],
  incoming: SessionCompletionVM[],
  dismissedIds: Set<string>,
): SessionCompletionVM[] {
  const incomingById = new Map(incoming.map((session) => [session.id, session]));
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

// How long a card takes to glide from one depth slot to the next (e.g. the
// second card easing forward into the front slot once the first resolves).
const STACK_TRANSITION_MS = 320;
const STACK_EASING = Easing.out(Easing.cubic);

// A single card in the stack. Depth-based opacity/scale/offset are driven by a
// shared value animated with `withTiming` (rather than plain inline style
// numbers) so that when a card's `depth` prop changes — e.g. it moves from the
// second slot into the front slot — it glides there instead of snapping
// instantly to the new values.
function StackedCard({
  depth,
  zIndex,
  isFront,
  children,
}: {
  depth: number;
  zIndex: number;
  isFront: boolean;
  children: React.ReactNode;
}) {
  const depthValue = useSharedValue(depth);

  useEffect(() => {
    depthValue.value = withTiming(depth, {
      duration: STACK_TRANSITION_MS,
      easing: STACK_EASING,
    });
  }, [depth, depthValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - depthValue.value * 0.35,
    transform: [
      { scale: 1 - depthValue.value * 0.05 },
      { translateY: depthValue.value * -8 },
    ],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(280)}
      pointerEvents={isFront ? 'auto' : 'none'}
      style={[isFront ? styles.frontCard : styles.behindCard, { zIndex }, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

// Card-stack visual, not a manually-paged list: only the front card is
// interactive, the rest peek out from behind it (decreasing scale/opacity,
// offset upward) like a physical deck. Resolving the front card (rating or
// disputing — a bare confirm still shows the rating widget in the same slot, it
// doesn't advance) holds on the confirmation message briefly, then fades it out;
// every card behind glides forward into the next slot. With none left, the whole
// section fades away. Matches the web carousel's stack depth/timing
// (packages/ui-web/src/components/dashboard/session-completed-carousel.tsx).
export function SessionCompletedCarousel({
  sessions,
  colors,
}: {
  sessions: SessionCompletionVM[];
  colors: AppColors;
}) {
  const [visibleSessions, setVisibleSessions] = useState(() => orderForStack(sessions));
  const pendingTimeouts = useRef(new Set<ReturnType<typeof setTimeout>>());
  // Per-card "grace" timers (confirm → rotate to back) kept separately so a
  // later rating can cancel the pending rotate and remove the card instead.
  const graceTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Cards the viewer has closed — remembered so a re-fetch can't bring them back.
  const dismissedIds = useRef(new Set<string>());

  useEffect(() => {
    setVisibleSessions((prev) => mergeStack(prev, sessions, dismissedIds.current));
  }, [sessions]);

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
      setVisibleSessions((current) => current.filter((item) => item.id !== id));
    }, ADVANCE_DELAY_MS);
    pendingTimeouts.current.add(timeout);
  };

  // Manual close (×) on a confirmed card — the viewer is done with it without
  // leaving a rating. Drop it locally right away, remember the id so an in-flight
  // re-fetch can't slot it back in, and tell the server (skip-rating stamps
  // rated_at with no rating) so it stays gone on the next load / other devices.
  const dismiss = (session: SessionCompletionVM) => {
    clearGrace(session.id);
    dismissedIds.current.add(session.id);
    setVisibleSessions((current) => current.filter((item) => item.id !== session.id));
    void skipSessionCompletionRating({
      orgId: session.orgId,
      sessionCompletionId: session.id,
    }).catch((error: unknown) => {
      reportMobileObservedError({
        error,
        source: 'SessionCompletedCarousel.dismiss',
        message: 'Failed to skip rating for a dismissed session completion',
        context: { sessionCompletionId: session.id },
      });
    });
  };

  const scheduleSendToBack = (id: string) => {
    clearGrace(id);
    const timeout = setTimeout(() => {
      graceTimeouts.current.delete(id);
      setVisibleSessions((current) => {
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

  const current = visibleSessions[0] ?? null;

  if (!current) {
    return null;
  }

  const stack = visibleSessions.slice(0, STACK_DEPTH + 1);

  return (
    <Animated.View exiting={FadeOut.duration(300)} style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.sectionLabel, { color: colors.textFaint }]}>
          Recently completed
        </Text>
        <View style={[styles.countBadge, { backgroundColor: colors.tealBg }]}>
          <Text style={[styles.countText, { color: colors.teal }]}>
            {visibleSessions.length}
          </Text>
        </View>
      </View>

      <View style={styles.stackWrap}>
        {stack.map((item, depth) => {
          const isFront = depth === 0;
          return (
            <StackedCard
              key={item.id}
              depth={depth}
              zIndex={stack.length - depth}
              isFront={isFront}
            >
              {isFront ? (
                <SessionCompletedTile
                  completion={item}
                  colors={colors}
                  onCompletionSubmit={(status) => {
                    if (status === 'disputed') scheduleRemove(item.id);
                    else scheduleSendToBack(item.id);
                  }}
                  onRatingSubmit={() => scheduleRemove(item.id)}
                  onDismiss={() => dismiss(item)}
                />
              ) : (
                <View
                  style={[
                    styles.placeholderCard,
                    { borderColor: colors.border, backgroundColor: colors.inputBg },
                  ]}
                />
              )}
            </StackedCard>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stackWrap: {
    position: 'relative',
  },
  frontCard: {
    position: 'relative',
  },
  behindCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  placeholderCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
  },
});
