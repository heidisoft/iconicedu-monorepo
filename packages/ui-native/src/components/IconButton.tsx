import React from 'react';
import { type PressableProps } from 'react-native';
import { StyledPressable } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

type IconButtonVariant = 'default' | 'ghost' | 'outline';
type IconButtonSize = 'sm' | 'md' | 'lg';

export type IconButtonProps = PressableProps & {
  icon: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  label: string;
  className?: string;
};

const variantStyles: Record<IconButtonVariant, string> = {
  default: 'bg-slate-800',
  ghost: 'bg-transparent',
  outline: 'border border-slate-700 bg-transparent',
};

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'default',
  size = 'md',
  label,
  className,
  disabled,
  ...rest
}) => (
  <StyledPressable
    className={cn(
      'items-center justify-center rounded-full active:opacity-70',
      variantStyles[variant],
      sizeStyles[size],
      disabled && 'opacity-50',
      className,
    )}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: disabled ?? false }}
    {...rest}
  >
    {icon}
  </StyledPressable>
);
