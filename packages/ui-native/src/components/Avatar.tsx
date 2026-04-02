import React, { useMemo } from 'react';
import { View, Text, Image } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@iconicedu/ui-native/lib/utils';
import type { PresenceDisplayStatusVM } from '@iconicedu/shared-types';

const avatarFrameVariants = cva(
  'relative rounded-full items-center justify-center overflow-hidden border border-border',
  {
    variants: {
      size: {
        xs: 'h-6 w-6',
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

const avatarTextVariants = cva('font-semibold text-muted-foreground', {
  variants: {
    size: {
      xs: 'text-[10px]',
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-xl',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const statusDotSize: Record<string, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-4 w-4',
};

const statusColors: Record<PresenceDisplayStatusVM, string> = {
  online: 'bg-success',
  idle: 'bg-warning',
  busy: 'bg-destructive',
  away: 'bg-muted-foreground',
  offline: 'bg-muted',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

type AvatarSize = NonNullable<VariantProps<typeof avatarFrameVariants>['size']>;

type AvatarProps = {
  src?: string | null;
  name?: string;
  seed?: string | null;
  size?: AvatarSize;
  status?: PresenceDisplayStatusVM;
  className?: string;
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  seed: _seed,
  size = 'md',
  status,
  className,
}) => {
  const label = name || 'Avatar';
  const initials = useMemo(() => getInitials(name), [name]);

  return (
    <View className={cn('relative', className)} accessibilityLabel={label}>
      <View className={cn(avatarFrameVariants({ size }))}>
        {src ? (
          <Image source={{ uri: src }} className="h-full w-full rounded-full" />
        ) : (
          <View className="h-full w-full items-center justify-center rounded-full bg-muted">
            <Text className={cn(avatarTextVariants({ size }))}>{initials}</Text>
          </View>
        )}
      </View>
      {status && status !== 'offline' && (
        <View
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-background',
            statusDotSize[size],
            statusColors[status],
          )}
        />
      )}
    </View>
  );
};

export type { AvatarProps };
