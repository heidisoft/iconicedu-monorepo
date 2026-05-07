import React from 'react';
import { View } from 'react-native';

import {
  Badge as PrimitiveBadge,
  badgeTextVariants,
  badgeVariants,
} from '@iconicedu/ui-native/components/ui/badge';
import { Text } from '@iconicedu/ui-native/components/ui/text';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { badgeClasses } from '@iconicedu/ui-native/theme';

type PrimitiveBadgeProps = React.ComponentProps<typeof PrimitiveBadge>;
type PrimitiveVariant = NonNullable<PrimitiveBadgeProps['variant']>;

type BadgeVariant = PrimitiveVariant | 'success' | 'warning' | 'error' | 'info';

const variantClasses: Partial<Record<BadgeVariant, { badge: string; text: string }>> = {
  success: { badge: 'bg-success border-transparent', text: 'text-success-foreground' },
  warning: { badge: 'bg-warning border-transparent', text: 'text-warning-foreground' },
  error: {
    badge: 'bg-destructive border-transparent',
    text: 'text-destructive-foreground',
  },
  info: { badge: 'bg-info border-transparent', text: 'text-info-foreground' },
};

function toPrimitiveVariant(variant?: BadgeVariant): PrimitiveVariant {
  if (variant === 'error') return 'destructive';
  if (variant === 'success' || variant === 'warning' || variant === 'info') {
    return 'secondary';
  }
  return variant ?? 'default';
}

export type BadgeProps = Omit<PrimitiveBadgeProps, 'variant' | 'children'> & {
  count?: number;
  label?: string;
  maxCount?: number;
  size?: 'sm' | 'default' | 'md';
  dot?: boolean;
  variant?: BadgeVariant;
};

export const Badge: React.FC<BadgeProps> = ({
  count,
  label,
  variant = 'default',
  size = 'default',
  maxCount = 99,
  dot = false,
  className,
  ...rest
}) => {
  const primitiveVariant = toPrimitiveVariant(variant);
  const legacyClasses = variantClasses[variant];

  if (dot) {
    return (
      <View
        className={cn(
          'h-[10px] w-[10px] rounded-full',
          legacyClasses?.badge ?? badgeVariants({ variant: primitiveVariant }),
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
    <PrimitiveBadge
      variant={primitiveVariant}
      className={cn(badgeClasses[size], legacyClasses?.badge, className)}
      accessibilityLabel={`${displayText} notifications`}
      {...rest}
    >
      <Text className={legacyClasses?.text}>{displayText}</Text>
    </PrimitiveBadge>
  );
};

export { badgeVariants, badgeTextVariants };
