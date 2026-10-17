import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from './use-reduced-motion';

export function NativeControlPop({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    scale.setValue(reduced ? 1 : 0.55);
    if (reduced) return;
    const animation = Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [value, reduced, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

export function NativeFloatingReaction({ emoji }: { emoji: string }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    if (reduced) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 2800,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [emoji, reduced, progress]);
  return (
    <Animated.Text
      accessible={false}
      importantForAccessibility="no"
      style={{
        position: 'absolute',
        bottom: 48,
        left: '50%',
        fontSize: 32,
        opacity: reduced
          ? 1
          : progress.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 0] }),
        transform: reduced
          ? []
          : [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -340],
                }),
              },
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 60],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.12, 1],
                  outputRange: [0.3, 1.1, 0.95],
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '18deg'],
                }),
              },
            ],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}
