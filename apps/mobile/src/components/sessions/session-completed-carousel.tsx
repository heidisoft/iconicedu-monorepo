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
import { SessionCompletedTile } from '@/components/sessions/session-completed-tile';

// How long the tile's own "Thank you" / "Reported" confirmation stays on screen
// before it advances — mirrors the web carousel (session-completed-carousel.tsx in
// packages/ui-web). Without this pause, scheduling removal in the same tick as the
// confirmation appearing meant the confirmation never actually got seen.
const ADVANCE_DELAY_MS = 1400;

// How many cards deep the stack renders — the front (interactive) card plus this
// many peeking placeholders behind it. Matches the web card-stack depth.
const STACK_DEPTH = 2;

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
  const [visibleSessions, setVisibleSessions] = useState(sessions);
  const pendingTimeouts = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setVisibleSessions(sessions);
  }, [sessions]);

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
      setVisibleSessions((current) => current.filter((item) => item.id !== id));
    }, ADVANCE_DELAY_MS);
    pendingTimeouts.current.add(timeout);
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
                  }}
                  onRatingSubmit={() => scheduleRemove(item.id)}
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
