import React, { useEffect, useRef } from 'react';
import { Animated, type ViewProps } from 'react-native';

type AnimatedViewWithClassName = Animated.AnimatedProps<ViewProps> & {
  className?: string;
};
const StyledAnimatedView = Animated.View as React.ComponentType<AnimatedViewWithClassName>;

export type SkeletonProps = {
  width?: number;
  height?: number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
};

const roundedStyles: Record<string, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  rounded = 'md',
  className,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const classes = ['bg-slate-700', roundedStyles[rounded], className]
    .filter(Boolean)
    .join(' ');

  return (
    <StyledAnimatedView
      style={{ opacity, width, height }}
      className={classes}
      accessibilityLabel="Loading"
    />
  );
};
