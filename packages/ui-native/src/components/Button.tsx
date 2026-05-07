import React, { useCallback } from 'react';
import { ActivityIndicator, type GestureResponderEvent } from 'react-native';

import {
  Button as PrimitiveButton,
  buttonTextVariants,
  buttonVariants,
} from '@iconicedu/ui-native/components/ui/button';
import { Text } from '@iconicedu/ui-native/components/ui/text';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';

type PrimitiveButtonProps = React.ComponentProps<typeof PrimitiveButton>;
type PrimitiveVariant = NonNullable<PrimitiveButtonProps['variant']>;

type ButtonVariant = PrimitiveVariant | 'primary';

export type ButtonProps = Omit<PrimitiveButtonProps, 'variant' | 'children'> & {
  /** Text label — for backward compat. Prefer children instead. */
  label?: string;
  /** When set, fires a 'button_clicked' analytics event with this label on press. */
  analyticsLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  textClassName?: string;
  variant?: ButtonVariant;
  children?: React.ReactNode;
};

function toPrimitiveVariant(variant?: ButtonVariant): PrimitiveVariant {
  return variant === 'primary' ? 'default' : (variant ?? 'default');
}

export const Button: React.FC<ButtonProps> = ({
  label,
  analyticsLabel,
  variant = 'default',
  loading = false,
  disabled = false,
  textClassName,
  children,
  onPress,
  ...rest
}) => {
  const track = useUiTracking();
  const primitiveVariant = toPrimitiveVariant(variant);

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

  const content = children ?? label;

  return (
    <PrimitiveButton
      variant={primitiveVariant}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      onPress={handlePress}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" />
      ) : typeof content === 'string' ? (
        <Text className={textClassName}>{content}</Text>
      ) : (
        content
      )}
    </PrimitiveButton>
  );
};

export { buttonVariants, buttonTextVariants };
