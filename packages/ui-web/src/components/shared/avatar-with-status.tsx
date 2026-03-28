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
import { HoverCard, HoverCardTrigger } from '@iconicedu/ui-web/ui/hover-card';
import { AvatarProfileHoverCardContent } from '@iconicedu/ui-web/components/shared/avatar-profile-hover-card-content';
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
}

const getInitials = (name?: string | null, maxLength = 1) =>
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
  roleLabel,
  email,
  timezone,
  locationLabel,
  about,
  messageHref,
  onMessageClick,
  enableProfilePreview = true,
}: AvatarWithStatusProps) {
  const liveStatus = presence?.liveStatus ?? 'offline';
  const derivedDisplayStatus =
    presence?.displayStatus ?? LIVE_STATUS_TO_DISPLAY[liveStatus];
  const shouldShowStatus = showStatus !== undefined ? showStatus : !!presence;
  const avatarUrl = avatar?.url ?? null;
  const statusText = presence?.state?.text?.trim();
  const statusEmoji = presence?.state?.emoji?.trim();
  const localTimeLabel = getLocalTimeLabel(timezone);
  const shouldShowPreview = enableProfilePreview;
  const previewAbout = about?.trim() || statusText || null;
  const canMessage = Boolean(messageHref || onMessageClick);

  const themeClass = themeKey ? `theme-${themeKey}` : '';
  const previewHeaderStyle = themeKey
    ? {
        backgroundColor: 'color-mix(in oklab, var(--theme-bg) 18%, var(--muted) 82%)',
      }
    : undefined;
  const safeName = name?.trim() ? name.trim() : 'User';
  const renderAvatar = React.useCallback(
    ({
      sizeClassName: avatarSizeClassName,
      initials = initialsLength,
      fallbackExtraClassName,
      statusExtraClassName,
    }: {
      sizeClassName: string;
      initials?: number;
      fallbackExtraClassName?: string;
      statusExtraClassName?: string;
    }) => (
      <div className="relative z-10">
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
              STATUS_COLORS[derivedDisplayStatus],
              statusClassName ?? 'bottom-0 right-0 h-2.5 w-2.5',
              statusExtraClassName,
            )}
            aria-label={`Status: ${derivedDisplayStatus}`}
          />
        )}
      </div>
    ),
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
    ],
  );
  const avatarNode = renderAvatar({
    sizeClassName: sizeClassName ?? '',
  });
  const previewAvatarNode = renderAvatar({
    sizeClassName: 'size-24 border-4 border-background shadow-lg',
    initials: 2,
    fallbackExtraClassName: 'text-xl font-semibold',
    statusExtraClassName: 'bottom-1 right-1 size-5 border-[3px] border-background',
  });

  if (!shouldShowPreview) {
    return avatarNode;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{avatarNode}</HoverCardTrigger>
      <AvatarProfileHoverCardContent
        avatarNode={previewAvatarNode}
        canMessage={canMessage}
        email={email}
        lastSeenLabel={
          presence?.lastSeenAt ? `Last seen ${formatLastSeen(presence.lastSeenAt)}` : null
        }
        localTimeLabel={localTimeLabel}
        locationLabel={locationLabel}
        messageHref={messageHref}
        onMessageClick={onMessageClick}
        previewAbout={previewAbout}
        previewHeaderStyle={previewHeaderStyle}
        roleLabel={roleLabel}
        safeName={safeName}
        statusEmoji={statusEmoji}
        themeClass={themeClass}
      />
    </HoverCard>
  );
}

function getLocalTimeLabel(timezone?: string | null) {
  if (!timezone?.trim()) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat([], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date());
  } catch {
    return null;
  }
}

function formatLastSeen(value: string) {
  return new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
