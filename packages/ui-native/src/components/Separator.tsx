import React from 'react';
import { StyledView } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

export type SeparatorProps = {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
};

export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  className,
}) => (
  <StyledView
    className={cn(
      'bg-slate-800',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    accessibilityRole="none"
  />
);
