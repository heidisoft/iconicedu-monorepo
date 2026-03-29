'use client';

import * as React from 'react';
import type {
  AvatarVM,
  LiveStatusVM,
  PresenceDisplayStatusVM,
  PresenceVM,
  ThemeKey,
  UserAccountVM,
  UserLocationVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
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
  accountId,
  profileId,
  name,
  avatar,
  presence,
  themeKey,
  showStatus,
  initialsLength,
  sizeClassName,
  statusClassName,
  fallbackClassName,
  messageHref,
  onMessageClick,
  enableProfilePreview = true,
}: AvatarWithStatusProps) {
  const liveStatus = presence?.liveStatus ?? 'offline';
  const derivedDisplayStatus =
    presence?.displayStatus ?? LIVE_STATUS_TO_DISPLAY[liveStatus];
  const avatarUrl = avatar?.url ?? null;
  const statusText = presence?.state?.text?.trim();
  const statusEmoji = presence?.state?.emoji?.trim();
  const shouldShowPreview = enableProfilePreview;
  const canMessage = Boolean(messageHref || onMessageClick);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewPayload, setPreviewPayload] = React.useState<{
    account?: Pick<UserAccountVM, 'contacts' | 'lifecycle'> | null;
    profile?: UserProfileVM | null;
  } | null>(null);
  const previewRequestKey = accountId || profileId || null;
  const loadedPreviewKeyRef = React.useRef<string | null>(null);
  const loadingPreviewKeyRef = React.useRef<string | null>(null);

  const themeClass = themeKey ? `theme-${themeKey}` : '';
  const previewHeaderStyle = themeKey
    ? {
        backgroundColor: 'color-mix(in oklab, var(--theme-bg) 18%, var(--muted) 82%)',
      }
    : undefined;
  const safeName = name?.trim() ? name.trim() : 'User';
  const resolvedPreviewProfile = previewPayload?.profile ?? null;
  const shouldShowStatus =
    showStatus !== undefined
      ? showStatus
      : Boolean(presence ?? resolvedPreviewProfile?.presence);
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
              STATUS_COLORS[displayStatus],
              statusClassName ?? 'bottom-0 right-0 h-2.5 w-2.5',
              statusExtraClassName,
            )}
            aria-label={`Status: ${displayStatus}`}
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
  const resolvedPreviewName = resolvedPreviewProfile
    ? getProfileDisplayName(resolvedPreviewProfile.profile, 'User')
    : safeName;
  const resolvedPreviewRoleLabel = resolvedPreviewProfile
    ? getAvatarRoleLabel(resolvedPreviewProfile.kind)
    : null;
  const resolvedPreviewLocationLabel = resolvedPreviewProfile
    ? getAvatarLocationLabel(resolvedPreviewProfile.location)
    : null;
  const resolvedPreviewLocalTimeLabel = getLocalTimeLabel(
    resolvedPreviewProfile?.prefs.timezone,
  );
  const resolvedPreviewStatusText =
    resolvedPreviewProfile?.presence?.state?.text?.trim() ?? statusText;
  const resolvedPreviewStatusEmoji =
    resolvedPreviewProfile?.presence?.state?.emoji?.trim() ?? statusEmoji;
  const resolvedPreviewPresenceTone =
    resolvedPreviewProfile?.presence?.displayStatus ??
    (resolvedPreviewProfile?.presence?.liveStatus
      ? LIVE_STATUS_TO_DISPLAY[resolvedPreviewProfile.presence.liveStatus]
      : derivedDisplayStatus);
  const previewAvatarNode = renderAvatar({
    sizeClassName: 'size-24 border-4 border-background shadow-lg',
    initials: 2,
    fallbackExtraClassName: 'text-xl font-semibold',
    statusExtraClassName: 'bottom-1 right-1 size-5 border-[3px] border-background',
    displayStatus: resolvedPreviewPresenceTone,
  });
  const resolvedPreviewAbout =
    resolvedPreviewProfile?.profile.bio?.trim() || resolvedPreviewStatusText || null;
  const resolvedPreviewEmail =
    previewPayload?.account?.contacts?.email ??
    resolvedPreviewProfile?.accountEmail ??
    null;
  const formattedLastSeen = resolvedPreviewProfile?.presence?.lastSeenAt
    ? formatLastSeen(resolvedPreviewProfile.presence.lastSeenAt)
    : null;
  const resolvedPreviewLastSeenLabel = formattedLastSeen
    ? `Last seen ${formattedLastSeen}`
    : null;
  const shouldShowPreviewLoading =
    Boolean(previewRequestKey) && !previewPayload && !previewError;

  React.useEffect(() => {
    if (loadedPreviewKeyRef.current === previewRequestKey) {
      return;
    }

    setPreviewPayload(null);
    setPreviewError(null);
    setPreviewLoading(false);
    loadingPreviewKeyRef.current = null;
  }, [previewRequestKey]);

  React.useEffect(() => {
    if (!previewOpen) {
      setPreviewLoading(false);
      loadingPreviewKeyRef.current = null;
      return;
    }

    if (
      !previewRequestKey ||
      loadingPreviewKeyRef.current === previewRequestKey ||
      loadedPreviewKeyRef.current === previewRequestKey
    ) {
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadPreview = async () => {
      loadingPreviewKeyRef.current = previewRequestKey;
      loadedPreviewKeyRef.current = previewRequestKey;
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const params = new URLSearchParams();
        if (accountId) {
          params.set('accountId', accountId);
        }
        if (profileId) {
          params.set('profileId', profileId);
        }
        const response = await fetch(`/api/profile-preview?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
          payload?: {
            account?: Pick<UserAccountVM, 'contacts' | 'lifecycle'> | null;
            profile?: UserProfileVM | null;
          };
        };

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? 'Unable to load profile preview');
        }

        if (!result.payload?.account && !result.payload?.profile) {
          throw new Error('Unable to load profile preview');
        }

        if (!isCancelled) {
          setPreviewPayload(result.payload ?? null);
        }
      } catch (error) {
        if (controller.signal.aborted || isCancelled) {
          return;
        }
        loadedPreviewKeyRef.current = null;
        loadingPreviewKeyRef.current = null;
        setPreviewError(
          error instanceof Error ? error.message : 'Unable to load profile preview',
        );
      } finally {
        if (loadingPreviewKeyRef.current === previewRequestKey) {
          loadingPreviewKeyRef.current = null;
        }
        setPreviewLoading(false);
      }
    };

    void loadPreview();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [accountId, previewOpen, previewRequestKey, profileId]);

  if (!shouldShowPreview) {
    return avatarNode;
  }

  return (
    <HoverCard open={previewOpen} onOpenChange={setPreviewOpen}>
      <HoverCardTrigger asChild>{avatarNode}</HoverCardTrigger>
      <AvatarProfileHoverCardContent
        avatarNode={previewAvatarNode}
        canMessage={canMessage}
        email={resolvedPreviewEmail}
        error={previewError}
        lastSeenLabel={resolvedPreviewLastSeenLabel}
        loading={previewLoading || shouldShowPreviewLoading}
        localTimeLabel={resolvedPreviewLocalTimeLabel}
        locationLabel={resolvedPreviewLocationLabel}
        messageHref={messageHref}
        onMessageClick={onMessageClick}
        previewAbout={resolvedPreviewAbout}
        previewHeaderStyle={previewHeaderStyle}
        roleLabel={resolvedPreviewRoleLabel}
        safeName={resolvedPreviewName}
        statusSummary={resolvedPreviewStatusText}
        statusEmoji={resolvedPreviewStatusEmoji}
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
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 5) return 'few mins ago';
  if (minutes < 60) return `${minutes} mins ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;

  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}
