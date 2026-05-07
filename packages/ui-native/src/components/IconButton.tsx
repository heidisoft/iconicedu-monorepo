import React, { useCallback } from 'react';
import { type GestureResponderEvent } from 'react-native';

import {
  Button as PrimitiveButton,
  buttonVariants,
} from '@iconicedu/ui-native/components/ui/button';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';
import { createHitSlop, iconButtonClasses } from '@iconicedu/ui-native/theme';

type PrimitiveButtonProps = React.ComponentProps<typeof PrimitiveButton>;
type IconButtonVariant = 'default' | 'ghost' | 'outline';
type IconButtonSize = 'sm' | 'default' | 'lg';

function toPrimitiveVariant(
  variant?: IconButtonVariant,
): PrimitiveButtonProps['variant'] {
  if (variant === 'default') return 'secondary';
  return variant ?? 'secondary';
}

export type IconButtonProps = Omit<
  PrimitiveButtonProps,
  'variant' | 'size' | 'children'
> & {
  icon: React.ReactNode;
  /** Accessibility label — also used as the analytics event label. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
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
    <PrimitiveButton
      variant={toPrimitiveVariant(variant)}
      size="icon"
      className={cn('rounded-full', iconButtonClasses[size], className)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled ?? false }}
      hitSlop={hitSlop ?? (size === 'sm' ? createHitSlop(36) : undefined)}
      onPress={handlePress}
      {...rest}
    >
      {icon}
    </PrimitiveButton>
  );
};

export { buttonVariants as iconButtonVariants };
