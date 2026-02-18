import React from 'react';
import { View } from 'react-native';
import { cn } from '@iconicedu/ui-native/lib/utils';

export type SeparatorProps = {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
};

export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  className,
}) => (
  <View
    className={cn(
      'bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    accessibilityRole="none"
  />
);
