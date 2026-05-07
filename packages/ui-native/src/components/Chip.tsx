import React, { useCallback } from 'react';
import { type GestureResponderEvent } from 'react-native';

import { Button as PrimitiveButton } from '@iconicedu/ui-native/components/ui/button';
import { Text } from '@iconicedu/ui-native/components/ui/text';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';
import { typography } from '@iconicedu/ui-native/theme';

type PrimitiveButtonProps = React.ComponentProps<typeof PrimitiveButton>;
type ChipVariant = 'default' | 'active' | 'outline';

const chipClasses: Record<ChipVariant, string> = {
  default: 'bg-secondary',
  active: 'bg-primary',
  outline: 'border border-border bg-transparent',
};

const chipTextClasses: Record<ChipVariant, string> = {
  default: 'text-secondary-foreground',
  active: 'text-primary-foreground',
  outline: 'text-muted-foreground',
};

export type ChipProps = Omit<PrimitiveButtonProps, 'variant' | 'size' | 'children'> & {
  label: string;
  icon?: React.ReactNode;
  variant?: ChipVariant;
};

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'default',
  icon,
  className,
  onPress,
  ...rest
}) => {
  const track = useUiTracking();

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      track('chip selected', {
        button_name: label,
        component_type: 'chip',
        variant: variant ?? 'default',
      });
      onPress?.(e);
    },
    [track, label, variant, onPress],
  );

  return (
    <PrimitiveButton
      variant={variant === 'outline' ? 'outline' : 'secondary'}
      size="sm"
      className={cn(
        'min-h-[32px] rounded-full px-3 py-1.5',
        chipClasses[variant],
        className,
      )}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ? handlePress : undefined}
      {...rest}
    >
      {icon}
      <Text className={cn(typography.meta, 'font-medium', chipTextClasses[variant])}>
        {label}
      </Text>
    </PrimitiveButton>
  );
};
