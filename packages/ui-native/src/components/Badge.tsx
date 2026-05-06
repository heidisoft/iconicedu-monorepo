import React from 'react';
import { View, Text } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@iconicedu/ui-native/lib/utils';

const badgeVariants = cva('items-center justify-center rounded-full', {
  variants: {
    variant: {
      default: 'bg-secondary',
      success: 'bg-success',
      warning: 'bg-warning',
      destructive: 'bg-destructive',
      info: 'bg-info',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const badgeTextVariants = cva('text-[11px] font-bold', {
  variants: {
    variant: {
      default: 'text-secondary-foreground',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      destructive: 'text-destructive-foreground',
      info: 'text-info-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type BadgeProps = VariantProps<typeof badgeVariants> & {
  count?: number;
  label?: string;
  maxCount?: number;
  dot?: boolean;
  className?: string;
};

export const Badge: React.FC<BadgeProps> = ({
  count,
  label,
  variant = 'default',
  maxCount = 99,
  dot = false,
  className,
}) => {
  if (dot) {
    return (
      <View
        className={cn(
          'h-[10px] w-[10px] rounded-full',
          badgeVariants({ variant }),
          className,
        )}
        accessibilityLabel="New notification"
      />
    );
  }

  const displayText =
    label ??
    (count !== undefined
      ? count > maxCount
        ? `${maxCount}+`
        : String(count)
      : undefined);

  if (displayText === undefined) return null;

  return (
    <View
      className={cn(badgeVariants({ variant }), 'px-2 py-0.5', className)}
      accessibilityLabel={`${displayText} notifications`}
    >
      <Text className={cn(badgeTextVariants({ variant }))}>{displayText}</Text>
    </View>
  );
};

export { badgeVariants, badgeTextVariants };
