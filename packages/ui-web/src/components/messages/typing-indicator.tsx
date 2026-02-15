'use client';

import { memo, useMemo } from 'react';
import type { UserProfileVM } from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface TypingIndicatorProps {
  profiles: UserProfileVM[];
  className?: string;
}

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

export const TypingIndicator = memo(function TypingIndicator({
  profiles,
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

  return (
    <div
      className={cn('px-4 py-2 text-xs text-muted-foreground', className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sr-only">{label}</span>
      <span>{label}</span>
    </div>
  );
});
