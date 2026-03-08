import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type GestureResponderEvent } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';

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
        sm: 'h-8 w-8',
        default: 'h-10 w-10',
        lg: 'h-12 w-12',
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
      onPress={handlePress}
      {...rest}
    >
      {icon}
    </Pressable>
  );
};

export { iconButtonVariants };
