import React, { useMemo } from 'react';
import { type ImageSourcePropType } from 'react-native';
import { StyledView, StyledText, StyledImage } from '@iconicedu/ui-native/utils/styled';
import { cn } from '@iconicedu/ui-native/utils/cn';
import type { PresenceDisplayStatusVM } from '@iconicedu/shared-types';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type AvatarProps = {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  status?: PresenceDisplayStatusVM;
  className?: string;
};

const sizeStyles: Record<AvatarSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

const textSizeStyles: Record<AvatarSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-xl',
};

const statusDotSize: Record<AvatarSize, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-4 w-4',
};

const statusColors: Record<PresenceDisplayStatusVM, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  busy: 'bg-red-500',
  away: 'bg-gray-400',
  offline: 'bg-gray-600',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  status,
  className,
}) => {
  const initials = useMemo(() => getInitials(name), [name]);

  return (
    <StyledView className={cn('relative', className)}>
      {src ? (
        <StyledImage
          source={{ uri: src } as ImageSourcePropType}
          className={cn(sizeStyles[size], 'rounded-full bg-slate-700')}
          accessibilityLabel={name ?? 'Avatar'}
        />
      ) : (
        <StyledView
          className={cn(
            sizeStyles[size],
            'items-center justify-center rounded-full bg-slate-700',
          )}
          accessibilityLabel={name ?? 'Avatar'}
        >
          <StyledText
            className={cn('font-semibold text-slate-300', textSizeStyles[size])}
          >
            {initials}
          </StyledText>
        </StyledView>
      )}
      {status && status !== 'offline' && (
        <StyledView
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-slate-950',
            statusDotSize[size],
            statusColors[status],
          )}
        />
      )}
    </StyledView>
  );
};
