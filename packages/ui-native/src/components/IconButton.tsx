import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type GestureResponderEvent } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';
import { createHitSlop, iconButtonClasses } from '@iconicedu/ui-native/theme';

const iconButtonVariants = cva(
  'items-center justify-center rounded-full active:opacity-70',
  {
    variants: {
      variant: {
        default: 'bg-secondary',
        ghost: 'bg-transparent',
        outline: 'border border-border bg-transparent',
      },
      size: {
        sm: iconButtonClasses.sm,
        default: iconButtonClasses.default,
        lg: iconButtonClasses.lg,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type IconButtonProps = PressableProps &
  VariantProps<typeof iconButtonVariants> & {
    icon: React.ReactNode;
    /** Accessibility label — also used as the analytics event label. */
    label: string;
    className?: string;
  };

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'default',
  size = 'default',
  label,
  className,
  disabled,
  hitSlop,
  onPress,
  ...rest
}) => {
  const track = useUiTracking();

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      track('button clicked', { button_name: label, component_type: 'icon_button' });
      onPress?.(e);
    },
    [track, label, onPress],
  );

  return (
    <Pressable
      className={cn(
        iconButtonVariants({ variant, size }),
        disabled && 'opacity-50',
        className,
      )}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled ?? false }}
      hitSlop={hitSlop ?? (size === 'sm' ? createHitSlop(36) : undefined)}
      onPress={handlePress}
      {...rest}
    >
      {icon}
    </Pressable>
  );
};

export { iconButtonVariants };
