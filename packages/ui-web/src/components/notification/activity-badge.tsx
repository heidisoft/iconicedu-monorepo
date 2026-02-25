'use client';

import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { AvatarGroup, AvatarGroupCount } from '@iconicedu/ui-web/ui/avatar';
import type { ActivityFeedItemVM } from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';

type ActivityBadgeProps = {
  activity: ActivityFeedItemVM;
  className?: string;
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 1)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export function ActivityBadge({ activity, className }: ActivityBadgeProps) {
  const leading = activity.content.leading;

  if (leading?.kind === 'avatars' && leading.avatars.length > 0) {
    const avatars = leading.avatars.slice(0, 2);
    const overflowCount =
      leading.overflowCount ?? Math.max(0, leading.avatars.length - avatars.length);

    return (
      <AvatarGroup className={cn('shrink-0 pt-0.5', className)}>
        {avatars.map((avatarItem, idx) => (
          <AvatarWithStatus
            key={`${avatarItem.name}-${idx}`}
            name={avatarItem.name}
            avatar={avatarItem.avatar}
            themeKey={avatarItem.themeKey}
            showStatus={false}
            sizeClassName="size-6 border-2 border-background"
            fallbackClassName="text-[10px]"
            initialsLength={1}
          />
        ))}
        {overflowCount > 0 && (
          <AvatarGroupCount className="text-[10px] size-6">
            +{overflowCount}
          </AvatarGroupCount>
        )}
      </AvatarGroup>
    );
  }

  const actor = activity.refs.actor;
  const actorName = getProfileDisplayName(actor.profile);
  const actorAvatar = actor.profile.avatar;
  const initials = getInitials(actorName);

  return (
    <AvatarWithStatus
      name={actorName}
      avatar={actorAvatar}
      themeKey={actor.ui?.themeKey}
      showStatus={false}
      sizeClassName={cn('size-6 shrink-0', className)}
      fallbackClassName="text-[10px]"
      fallbackText={initials}
      initialsLength={1}
    />
  );
}
