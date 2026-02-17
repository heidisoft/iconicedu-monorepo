import React from 'react';
import { type PressableProps } from 'react-native';
import { StyledPressable, StyledText } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

type ChipVariant = 'default' | 'active' | 'outline';

export type ChipProps = PressableProps & {
  label: string;
  variant?: ChipVariant;
  icon?: React.ReactNode;
  className?: string;
};

const variantStyles: Record<ChipVariant, string> = {
  default: 'bg-slate-800',
  active: 'bg-brand-600',
  outline: 'border border-slate-600 bg-transparent',
};

const textStyles: Record<ChipVariant, string> = {
  default: 'text-slate-300',
  active: 'text-white',
  outline: 'text-slate-300',
};

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'default',
  icon,
  className,
  ...rest
}) => (
  <StyledPressable
    className={cn(
      'flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-80',
      variantStyles[variant],
      className,
    )}
    accessibilityRole="button"
    accessibilityLabel={label}
    {...rest}
  >
    {icon}
    <StyledText className={cn('text-xs font-medium', textStyles[variant])}>
      {label}
    </StyledText>
  </StyledPressable>
);
