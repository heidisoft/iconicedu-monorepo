'use client';

import * as React from 'react';
import type {
  AvatarVM,
  LiveStatusVM,
  PresenceDisplayStatusVM,
  PresenceVM,
  ThemeKey,
  UserLocationVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { cn } from '@iconicedu/ui-web/lib/utils';

const STATUS_COLORS: Record<PresenceDisplayStatusVM, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  idle: 'bg-gray-400',
  busy: 'bg-red-600',
  offline: 'bg-gray-600',
};

const LIVE_STATUS_TO_DISPLAY: Record<LiveStatusVM, PresenceDisplayStatusVM> = {
  online: 'online',
  in_class: 'online',
  teaching: 'online',
  reviewing_work: 'idle',
  busy: 'busy',
  away: 'away',
  offline: 'offline',
};

interface AvatarWithStatusProps {
  accountId?: string | null;
  profileId?: string | null;
  name?: string | null;
  avatar?: AvatarVM | null;
  alt?: string;
  fallbackText?: string;
  presence?: PresenceVM | null;
  themeKey?: ThemeKey | null;
  showStatus?: boolean;
  initialsLength?: number;
  sizeClassName?: string;
  statusClassName?: string;
  fallbackClassName?: string;
  roleLabel?: string | null;
  email?: string | null;
  timezone?: string | null;
  locationLabel?: string | null;
  about?: string | null;
  messageHref?: string | null;
  onMessageClick?: (() => void) | null;
  enableProfilePreview?: boolean;
  onProfileClick?: (() => void) | null;
}

const getInitials = (name?: string | null, maxLength = 2) =>
  (name ?? '')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, Math.max(1, maxLength))
    .toUpperCase();

export function getAvatarRoleLabel(kind?: UserProfileVM['kind'] | string | null) {
  switch (kind) {
    case 'guardian':
      return 'Parent';
    case 'child':
      return 'Student';
    case 'educator':
      return 'Educator';
    case 'staff':
      return 'Staff';
    case 'system':
      return 'System';
    case null:
    case undefined:
    case '':
      return null;
    default:
      return kind;
  }
}

export function getAvatarLocationLabel(location?: UserLocationVM | null) {
  const parts = [location?.city, location?.region, location?.countryName]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}

export function AvatarWithStatus({
  name,
  avatar,
  presence,
  themeKey,
  showStatus,
  initialsLength,
  sizeClassName,
  statusClassName,
  fallbackClassName,
  onProfileClick,
}: AvatarWithStatusProps) {
  const liveStatus = presence?.liveStatus ?? 'offline';
  const derivedDisplayStatus =
    presence?.displayStatus ?? LIVE_STATUS_TO_DISPLAY[liveStatus];
  const avatarUrl = avatar?.url ?? null;

  const themeClass = themeKey ? `theme-${themeKey}` : '';
  const safeName = name?.trim() ? name.trim() : 'User';
  const shouldShowStatus = showStatus !== undefined ? showStatus : Boolean(presence);
  const renderAvatar = React.useCallback(
    ({
      sizeClassName: avatarSizeClassName,
      initials = initialsLength,
      fallbackExtraClassName,
      statusExtraClassName,
      displayStatus = derivedDisplayStatus,
    }: {
      sizeClassName: string;
      initials?: number;
      fallbackExtraClassName?: string;
      statusExtraClassName?: string;
      displayStatus?: PresenceDisplayStatusVM;
    }) => {
      const avatarContent = (
        <>
          <Avatar
            className={cn(
              avatarSizeClassName,
              themeClass,
              themeKey ? 'border theme-border' : '',
            )}
          >
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={safeName} /> : null}
            <AvatarFallback
              className={cn(
                fallbackClassName,
                fallbackExtraClassName,
                themeKey ? 'theme-bg theme-fg' : '',
              )}
            >
              {getInitials(safeName, initials)}
            </AvatarFallback>
          </Avatar>
          {shouldShowStatus && (
            <span
              className={cn(
                'absolute z-20 rounded-full border-2 border-card',
                STATUS_COLORS[displayStatus],
                statusClassName ?? 'bottom-0 right-0 h-2.5 w-2.5',
                statusExtraClassName,
              )}
              aria-label={`Status: ${displayStatus}`}
            />
          )}
        </>
      );

      if (onProfileClick) {
        return (
          <button
            type="button"
            onClick={onProfileClick}
            className="relative z-10 inline-flex rounded-full transition-opacity hover:opacity-80"
            aria-label={`View ${safeName}'s profile`}
          >
            {avatarContent}
          </button>
        );
      }

      return (
        <span className="relative z-10 inline-flex rounded-full">{avatarContent}</span>
      );
    },
    [
      avatarUrl,
      derivedDisplayStatus,
      fallbackClassName,
      initialsLength,
      safeName,
      shouldShowStatus,
      statusClassName,
      themeClass,
      themeKey,
      onProfileClick,
    ],
  );
  const avatarNode = renderAvatar({
    sizeClassName: sizeClassName ?? '',
  });

  return avatarNode;
}
