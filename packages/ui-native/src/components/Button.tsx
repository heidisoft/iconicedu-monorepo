import React from 'react';
import { type PressableProps, ActivityIndicator } from 'react-native';
import { StyledPressable, StyledText } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

const baseStyles =
  'flex-row items-center justify-center rounded-2xl active:opacity-80';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600',
  secondary: 'bg-slate-800',
  ghost: 'bg-transparent',
  destructive: 'bg-red-600',
  outline: 'border border-slate-600 bg-transparent',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2.5',
  lg: 'px-6 py-3.5',
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  ghost: 'text-slate-300',
  destructive: 'text-white',
  outline: 'text-slate-200',
};

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  ...rest
}) => (
  <StyledPressable
    className={cn(
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      disabled && 'opacity-50',
      className,
    )}
    disabled={disabled || loading}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || loading }}
    {...rest}
  >
    {loading ? (
      <ActivityIndicator
        size="small"
        color={variant === 'ghost' || variant === 'outline' ? '#94a3b8' : '#ffffff'}
      />
    ) : (
      <StyledText
        className={cn(
          'font-medium',
          textSizeStyles[size],
          variantTextStyles[variant],
        )}
      >
        {label}
      </StyledText>
    )}
  </StyledPressable>
);
