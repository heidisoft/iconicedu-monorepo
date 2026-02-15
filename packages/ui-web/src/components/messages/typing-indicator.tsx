'use client';

import { memo, useMemo } from 'react';
import type { UserProfileVM } from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { AvatarGroup, AvatarGroupCount } from '@iconicedu/ui-web/ui/avatar';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';

interface TypingIndicatorProps {
  profiles: UserProfileVM[];
  variant?: 'inline' | 'message';
  className?: string;
}

const INLINE_AVATAR_LIMIT = 2;

function joinNamesForTyping(names: string[]): string {
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  const remaining = names.length - 2;
  return `${names[0]}, ${names[1]}, and ${remaining} other${remaining > 1 ? 's' : ''}`;
}

function buildTypingLabel(names: string[]): string {
  if (!names.length) {
    return '';
  }
  const subject = joinNamesForTyping(names);
  const verb = names.length === 1 ? 'is' : 'are';
  return `${subject} ${verb} typing`;
}

const TypingDots = memo(function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
    </span>
  );
});

export const TypingIndicator = memo(function TypingIndicator({
  profiles,
  variant = 'message',
  className,
}: TypingIndicatorProps) {
  const typingProfiles = useMemo(
    () =>
      profiles.filter(
        (profile, index, items) =>
          items.findIndex((item) => item.ids.id === profile.ids.id) === index,
      ),
    [profiles],
  );
  const names = useMemo(
    () => typingProfiles.map((profile) => getProfileDisplayName(profile.profile)),
    [typingProfiles],
  );
  const label = useMemo(() => buildTypingLabel(names), [names]);

  if (!typingProfiles.length) {
    return null;
  }

  if (variant === 'message') {
    const primary = typingProfiles[0];
    const primaryName = getProfileDisplayName(primary.profile);
    const remainingCount = Math.max(0, typingProfiles.length - 1);
    const displayName =
      remainingCount > 0
        ? `${primaryName} and ${remainingCount} other${remainingCount > 1 ? 's' : ''}`
        : primaryName;

    return (
      <div
        className={cn('flex items-start gap-3 px-4 py-2', className)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <AvatarWithStatus
          name={primaryName}
          avatar={primary.profile.avatar}
          themeKey={primary.ui?.themeKey ?? null}
          showStatus={false}
          sizeClassName="size-8 border-2 border-background"
          fallbackClassName="text-xs"
          initialsLength={2}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">{displayName}</span>
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <span className="sr-only">{label}</span>
            <TypingDots />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <AvatarGroup className="shrink-0">
        {typingProfiles.slice(0, INLINE_AVATAR_LIMIT).map((profile) => (
          <AvatarWithStatus
            key={profile.ids.id}
            name={getProfileDisplayName(profile.profile)}
            avatar={profile.profile.avatar}
            themeKey={profile.ui?.themeKey ?? null}
            showStatus={false}
            sizeClassName="size-6 border-2 border-background"
            fallbackClassName="text-[10px]"
            initialsLength={2}
          />
        ))}
        {typingProfiles.length > INLINE_AVATAR_LIMIT && (
          <AvatarGroupCount className="text-[10px] size-6">
            +{typingProfiles.length - INLINE_AVATAR_LIMIT}
          </AvatarGroupCount>
        )}
      </AvatarGroup>
      <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
        <span className="sr-only">{label}</span>
        <span>Typing</span>
        <span className="ml-1.5">
          <TypingDots />
        </span>
      </div>
    </div>
  );
});
