import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type GestureResponderEvent,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, TextClassContext } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';
import {
  buttonClasses,
  buttonTextClasses,
  useDensity,
  type Density,
} from '@iconicedu/ui-native/theme';

const DENSITY_TO_SIZE: Record<Density, 'sm' | 'default' | 'lg' | 'xl'> = {
  compact: 'sm',
  comfortable: 'default',
  spacious: 'lg',
};

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-2xl active:opacity-80',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-secondary',
        ghost: 'bg-transparent',
        destructive: 'bg-destructive',
        outline: 'border border-border bg-transparent',
      },
      size: {
        sm: buttonClasses.sm,
        default: buttonClasses.default,
        lg: buttonClasses.lg,
        xl: buttonClasses.xl,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const buttonTextVariants = cva('font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-muted-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
    },
    size: {
      sm: buttonTextClasses.sm,
      default: buttonTextClasses.default,
      lg: buttonTextClasses.lg,
      xl: buttonTextClasses.xl,
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    /** Text label — for backward compat. Prefer children instead. */
    label?: string;
    /** When set, fires a 'button_clicked' analytics event with this label on press. */
    analyticsLabel?: string;
    loading?: boolean;
    disabled?: boolean;
    className?: string;
    textClassName?: string;
    children?: React.ReactNode;
  };

export const Button: React.FC<ButtonProps> = ({
  label,
  analyticsLabel,
  variant = 'default',
  size,
  loading = false,
  disabled = false,
  className,
  textClassName,
  children,
  onPress,
  ...rest
}) => {
  const contextDensity = useDensity();
  const resolvedSize = size ?? DENSITY_TO_SIZE[contextDensity];
  const textClass = cn(
    buttonTextVariants({ variant, size: resolvedSize }),
    textClassName,
  );
  const track = useUiTracking();

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      const trackLabel = analyticsLabel ?? label;
      if (trackLabel) {
        track('button clicked', {
          button_name: trackLabel,
          component_type: 'button',
          variant: variant ?? 'default',
        });
      }
      onPress?.(e);
    },
    [track, analyticsLabel, label, variant, onPress],
  );

  return (
    <TextClassContext.Provider value={textClass}>
      <Pressable
        className={cn(
          buttonVariants({ variant, size: resolvedSize }),
          disabled && 'opacity-50',
          className,
        )}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading }}
        onPress={handlePress}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'ghost' || variant === 'outline' ? '#a1a1aa' : '#ffffff'}
          />
        ) : children ? (
          typeof children === 'string' ? (
            <Text className={textClass}>{children}</Text>
          ) : (
            children
          )
        ) : label ? (
          <Text className={textClass}>{label}</Text>
        ) : null}
      </Pressable>
    </TextClassContext.Provider>
  );
};

export { buttonVariants, buttonTextVariants };
