import React, { useMemo } from 'react';
import { View } from 'react-native';

import type { PresenceDisplayStatusVM } from '@iconicedu/shared-types';
import {
  Avatar as PrimitiveAvatar,
  AvatarFallback,
  AvatarImage,
} from '@iconicedu/ui-native/components/ui/avatar';
import { Text } from '@iconicedu/ui-native/components/ui/text';
import { cn } from '@iconicedu/ui-native/lib/utils';
import { typography } from '@iconicedu/ui-native/theme';

const avatarSizeClasses = {
  xs: 'h-[24px] w-[24px]',
  sm: 'h-[32px] w-[32px]',
  md: 'h-[36px] w-[36px]',
  lg: 'h-[44px] w-[44px]',
  xl: 'h-[56px] w-[56px]',
} as const;

const avatarTextClasses = {
  xs: 'text-[10px]',
  sm: typography.caption,
  md: typography.meta,
  lg: typography.body,
  xl: typography.title,
} as const;

const statusDotSize = {
  xs: 'h-[6px] w-[6px]',
  sm: 'h-[8px] w-[8px]',
  md: 'h-[10px] w-[10px]',
  lg: 'h-[12px] w-[12px]',
  xl: 'h-[14px] w-[14px]',
} as const;

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

type AvatarSize = keyof typeof avatarSizeClasses;

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
    <View className={cn('relative', className)}>
      <PrimitiveAvatar
        alt={label}
        className={cn('border border-border', avatarSizeClasses[size])}
      >
        {src ? <AvatarImage source={{ uri: src }} /> : null}
        <AvatarFallback>
          <Text
            className={cn('text-muted-foreground font-semibold', avatarTextClasses[size])}
          >
            {initials}
          </Text>
        </AvatarFallback>
      </PrimitiveAvatar>
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
