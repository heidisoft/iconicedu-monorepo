import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { GripVertical, Pencil, X } from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';

/** Matches the web launcher's width transition while honoring system reduced motion. */
export function NativeAnnotationBar({
  expanded,
  width,
  onToggle,
  dragHandlers,
  children,
}: {
  expanded: boolean;
  width: number;
  onToggle: () => void;
  dragHandlers?: React.ComponentProps<typeof View>;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [reducedMotion, setReducedMotion] = useState(false);
  const animatedWidth = useRef(new Animated.Value(expanded ? width : 52)).current;
  const previousWidth = useRef(expanded ? width : 52);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then((value) => {
        if (mounted) setReducedMotion(Boolean(value));
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);
  useEffect(() => {
    const target = expanded ? width : 52;
    if (!reducedMotion && previousWidth.current === target) return;
    previousWidth.current = target;
    const animation = Animated.timing(animatedWidth, {
      toValue: expanded ? width : 52,
      duration: reducedMotion ? 0 : 240,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animatedWidth, expanded, width, reducedMotion]);
  const Icon = expanded ? X : Pencil;
  return (
    <Animated.View
      testID="annotation-bar"
      style={{
        width: animatedWidth,
        maxWidth: width,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 3,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? 'Close annotation toolbar' : 'Open annotation toolbar'
        }
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon size={20} color={colors.text} />
      </Pressable>
      {expanded && (
        <>
          <View
            accessibilityLabel="Drag annotation toolbar"
            {...dragHandlers}
            style={{
              width: 28,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GripVertical size={20} color={colors.text} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        </>
      )}
    </Animated.View>
  );
}
