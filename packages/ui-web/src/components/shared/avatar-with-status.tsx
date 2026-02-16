'use client';

import type {
  AvatarVM,
  LiveStatusVM,
  PresenceDisplayStatusVM,
  PresenceVM,
  ThemeKey,
} from '@iconicedu/shared-types';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';

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
}

const getInitials = (name?: string | null, maxLength = 2) =>
  (name ?? '')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, Math.max(1, maxLength))
    .toUpperCase();

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
}: AvatarWithStatusProps) {
  const liveStatus = presence?.liveStatus ?? 'offline';
  const derivedDisplayStatus =
    presence?.displayStatus ?? LIVE_STATUS_TO_DISPLAY[liveStatus];
  const shouldShowStatus = showStatus !== undefined ? showStatus : !!presence;
  const avatarUrl = avatar?.url ?? null;
  const tooltipText = presence?.state?.text?.trim();
  const tooltipEmoji = presence?.state?.emoji?.trim();
  const shouldShowTooltip = Boolean(tooltipText || tooltipEmoji);

  const themeClass = themeKey ? `theme-${themeKey}` : '';
  const safeName = name?.trim() ? name.trim() : 'User';
  const avatarNode = (
    <div className="relative">
      <Avatar
        className={cn(sizeClassName, themeClass, themeKey ? 'border theme-border' : '')}
      >
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={safeName} /> : null}
        <AvatarFallback
          className={cn(fallbackClassName, themeKey ? 'theme-bg theme-fg' : '')}
        >
          {getInitials(safeName, initialsLength)}
        </AvatarFallback>
      </Avatar>
      {shouldShowStatus && (
        <span
          className={cn(
            'absolute rounded-full border-2 border-card',
            STATUS_COLORS[derivedDisplayStatus],
            statusClassName ?? 'bottom-0 right-0 h-2.5 w-2.5',
          )}
          aria-label={`Status: ${derivedDisplayStatus}`}
        />
      )}
    </div>
  );

  if (!shouldShowTooltip) {
    return avatarNode;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatarNode}</TooltipTrigger>
      <TooltipContent sideOffset={6}>
        <span className="inline-flex items-center gap-1.5">
          {tooltipEmoji ? <span>{tooltipEmoji}</span> : null}
          {tooltipText ? <span>{tooltipText}</span> : null}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
