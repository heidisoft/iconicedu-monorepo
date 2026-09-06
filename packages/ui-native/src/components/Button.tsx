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

const COLOR_UTILITY =
  /^(?:[\w-]+:)*(?:bg-|border-(?!0$|2$|4$|8$)|text-(?:action|ink|primary|secondary|muted|accent|destructive|foreground|background|card|popover|black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose))/;

function withoutLocalButtonColors(className?: string) {
  return className
    ?.split(/\s+/)
    .filter((classToken) => !COLOR_UTILITY.test(classToken))
    .join(' ');
}

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-2xl active:opacity-80',
  {
    variants: {
      variant: {
        default: 'bg-action',
        secondary: 'bg-ink',
        ghost: 'bg-transparent',
        destructive: 'bg-destructive',
        outline: 'border border-border bg-transparent',
      },
      size: {
        sm: 'px-3 py-1.5',
        default: 'px-4 py-2.5',
        lg: 'px-6 py-3.5',
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
      default: 'text-action-foreground',
      secondary: 'text-ink-foreground',
      ghost: 'text-muted-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
    },
    size: {
      sm: 'text-sm',
      default: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type ButtonProps = Omit<PressableProps, 'style'> &
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
  size = 'default',
  loading = false,
  disabled = false,
  className,
  textClassName,
  children,
  onPress,
  ...rest
}) => {
  const textClass = cn(
    buttonTextVariants({ variant, size }),
    withoutLocalButtonColors(textClassName),
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
          buttonVariants({ variant, size }),
          disabled && 'opacity-50',
          withoutLocalButtonColors(className),
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
            className={
              variant === 'ghost' || variant === 'outline'
                ? 'text-muted-foreground'
                : variant === 'destructive'
                  ? 'text-destructive-foreground'
                  : variant === 'secondary'
                    ? 'text-ink-foreground'
                    : 'text-action-foreground'
            }
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
