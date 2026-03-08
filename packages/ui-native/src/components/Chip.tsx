import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  type PressableProps,
  type GestureResponderEvent,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { useUiTracking } from '@iconicedu/ui-native/lib/tracking-context';

const chipVariants = cva(
  'flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-80',
  {
    variants: {
      variant: {
        default: 'bg-secondary',
        active: 'bg-primary',
        outline: 'border border-border bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const chipTextVariants = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-secondary-foreground',
      active: 'text-primary-foreground',
      outline: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type ChipProps = PressableProps &
  VariantProps<typeof chipVariants> & {
    label: string;
    icon?: React.ReactNode;
    className?: string;
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
    <Pressable
      className={cn(chipVariants({ variant }), className)}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ? handlePress : undefined}
      {...rest}
    >
      {icon}
      <Text className={cn(chipTextVariants({ variant }))}>{label}</Text>
    </Pressable>
  );
};

export { chipVariants, chipTextVariants };
