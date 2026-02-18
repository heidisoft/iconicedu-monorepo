import React, { useMemo } from 'react';
import { View, Text, Image, type ImageSourcePropType } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@iconicedu/ui-native/lib/utils';
import type { PresenceDisplayStatusVM } from '@iconicedu/shared-types';

const avatarVariants = cva('relative rounded-full bg-muted items-center justify-center', {
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
});

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

type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>['size']>;

export type AvatarProps = {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  status?: PresenceDisplayStatusVM;
  className?: string;
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  status,
  className,
}) => {
  const initials = useMemo(() => getInitials(name), [name]);

  return (
    <View className={cn('relative', className)}>
      {src ? (
        <Image
          source={{ uri: src } as ImageSourcePropType}
          className={cn(avatarVariants({ size }))}
          accessibilityLabel={name ?? 'Avatar'}
        />
      ) : (
        <View
          className={cn(avatarVariants({ size }))}
          accessibilityLabel={name ?? 'Avatar'}
        >
          <Text className={cn(avatarTextVariants({ size }))}>
            {initials}
          </Text>
        </View>
      )}
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
