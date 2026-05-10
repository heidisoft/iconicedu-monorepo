'use client';

import {
  AvatarWithStatus,
  getAvatarLocationLabel,
  getAvatarRoleLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { AvatarGroup, AvatarGroupCount } from '@iconicedu/ui-web/ui/avatar';
import type { ActivityFeedItemVM, ThemeKey } from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';

type ActivityBadgeProps = {
  activity: ActivityFeedItemVM;
  className?: string;
};

const ACTIVITY_AVATAR_SIZE_CLASS = 'size-6';
const MAX_VISIBLE_ACTIVITY_AVATARS = 3;
type ActivityLeadingAvatar = {
  accountId?: string | null;
  avatar: NonNullable<ActivityFeedItemVM['content']['leading']> extends {
    kind: 'avatars';
    avatars: Array<infer T>;
  }
    ? T extends { avatar: infer A }
      ? A
      : never
    : never;
  name: string;
  profileId?: string | null;
  themeKey?: ThemeKey | null;
};

export function ActivityBadge({ activity, className }: ActivityBadgeProps) {
  const leading = activity.content.leading;

  if (leading?.kind === 'avatars' && leading.avatars.length > 0) {
    const avatars = leading.avatars.slice(
      0,
      MAX_VISIBLE_ACTIVITY_AVATARS,
    ) as Array<ActivityLeadingAvatar>;
    const overflowCount =
      leading.overflowCount ?? Math.max(0, leading.avatars.length - avatars.length);

    return (
      <AvatarGroup className={cn('shrink-0 pt-0.5', className)}>
        {avatars.map((avatarItem, idx) => (
          <AvatarWithStatus
            key={`${avatarItem.name}-${idx}`}
            accountId={avatarItem.accountId ?? null}
            profileId={avatarItem.profileId ?? null}
            name={avatarItem.name}
            avatar={avatarItem.avatar}
            themeKey={avatarItem.themeKey}
            showStatus={false}
            enableProfilePreview={false}
            sizeClassName={ACTIVITY_AVATAR_SIZE_CLASS}
            fallbackClassName="text-[10px]"
          />
        ))}
        {overflowCount > 0 && (
          <AvatarGroupCount className={`text-[10px] ${ACTIVITY_AVATAR_SIZE_CLASS}`}>
            +{overflowCount}
          </AvatarGroupCount>
        )}
      </AvatarGroup>
    );
  }

  const actor = activity.refs.actor;
  if (!actor) {
    return null;
  }

  const actorName = getProfileDisplayName(actor.profile);
  const actorAvatar = actor.profile.avatar;

  return (
    <AvatarWithStatus
      accountId={actor.ids.accountId}
      profileId={actor.ids.id}
      name={actorName}
      avatar={actorAvatar}
      presence={actor.presence}
      themeKey={actor.ui?.themeKey}
      roleLabel={getAvatarRoleLabel(actor.kind)}
      timezone={actor.prefs?.timezone ?? null}
      locationLabel={getAvatarLocationLabel(actor.location)}
      about={actor.profile.bio ?? null}
      enableProfilePreview={false}
      sizeClassName={cn(ACTIVITY_AVATAR_SIZE_CLASS, 'shrink-0', className)}
      fallbackClassName="text-[10px]"
    />
  );
}
