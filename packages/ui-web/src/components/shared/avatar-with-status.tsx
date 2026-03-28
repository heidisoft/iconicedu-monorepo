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
import { BriefcaseBusiness, Clock3, MapPin, MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@iconicedu/ui-web/ui/hover-card';
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
      <div className="relative">
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
              'absolute rounded-full border-2 border-card',
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

  const messageButton = canMessage ? (
    messageHref ? (
      <Button asChild className="w-full sm:w-auto">
        <a href={messageHref}>
          <MessageCircle className="size-4" />
          Message
        </a>
      </Button>
    ) : (
      <Button className="w-full sm:w-auto" onClick={onMessageClick ?? undefined}>
        <MessageCircle className="size-4" />
        Message
      </Button>
    )
  ) : null;

  if (!shouldShowPreview) {
    return avatarNode;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{avatarNode}</HoverCardTrigger>
      <HoverCardContent className="w-[22rem] overflow-hidden p-0 sm:w-[26rem]">
        <div className="bg-sky-100 px-5 pb-5 dark:bg-sky-950/40">
          <div className="h-24 rounded-t-2xl" />
          <div className="-mt-10">
            {renderAvatar({
              sizeClassName: 'size-20 border-4 border-background shadow-sm',
              initials: 2,
              fallbackExtraClassName: 'text-xl font-semibold',
              statusExtraClassName:
                'bottom-1 right-1 size-5 border-[3px] border-background',
            })}
          </div>
        </div>

        <div className="space-y-4 px-5 pb-5 pt-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xl font-semibold text-foreground">
                    {safeName}
                  </p>
                  <Badge variant="outline" className="capitalize">
                    {derivedDisplayStatus}
                  </Badge>
                </div>
                {email ? (
                  <p className="truncate text-sm text-muted-foreground">{email}</p>
                ) : null}
              </div>
              {messageButton}
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground">
              {roleLabel ? (
                <div className="flex items-start gap-2">
                  <BriefcaseBusiness className="mt-0.5 size-4 shrink-0" />
                  <span>{roleLabel}</span>
                </div>
              ) : null}
              {locationLabel ? (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span>{locationLabel}</span>
                </div>
              ) : null}
              {localTimeLabel ? (
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 size-4 shrink-0" />
                  <span>Local time {localTimeLabel}</span>
                </div>
              ) : null}
            </div>
          </div>

          {previewAbout ? (
            <div className="space-y-2 border-t border-border/60 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                About
              </p>
              <p className="text-sm leading-6 text-foreground/90">
                {statusEmoji ? `${statusEmoji} ` : ''}
                {previewAbout}
              </p>
            </div>
          ) : null}

          {presence?.lastSeenAt ? (
            <p className="text-xs text-muted-foreground">
              Last seen {formatLastSeen(presence.lastSeenAt)}
            </p>
          ) : null}
        </div>
      </HoverCardContent>
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
