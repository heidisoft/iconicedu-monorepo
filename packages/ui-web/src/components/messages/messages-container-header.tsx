'use client';

import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Bookmark,
  BriefcaseBusiness,
  Clock,
  ClipboardCheck,
  FileText,
  Presentation,
  Sparkles,
  ShieldUser,
  User,
  type LucideIcon,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  AvatarWithStatus,
  getAvatarLocationLabel,
  getAvatarRoleLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { getChannelTopicIcon } from '@iconicedu/ui-web/lib/icons';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import type { ChannelVM, UserProfileVM } from '@iconicedu/shared-types';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

interface HeaderSubtitleEntry {
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  tooltip?: string;
  isActive?: boolean;
}

interface MessagesContainerHeaderProps {
  channel: ChannelVM;
}

const HeaderSubtitleItem = memo(function HeaderSubtitleItem({
  icon: Icon,
  label,
  onClick,
  className,
  tooltip,
  isActive,
}: {
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
  tooltip?: string;
  isActive?: boolean;
}) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-muted-foreground',
        onClick && 'cursor-pointer',
        isActive && 'text-primary font-medium',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );

  if (!onClick || !tooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
});

const HeaderTitle = memo(function HeaderTitle({
  title,
  inlineStatusLabel,
  leading,
  onClick,
  ariaLabel,
}: {
  title: string;
  inlineStatusLabel?: ReactNode;
  leading: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {leading}
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 cursor-pointer flex-col items-start text-sm font-semibold text-foreground"
          aria-label={ariaLabel ?? title}
        >
          <span className="truncate">{title}</span>
          {inlineStatusLabel ? (
            <span className="min-w-0 text-xs font-normal text-muted-foreground">
              {inlineStatusLabel}
            </span>
          ) : null}
        </button>
      ) : (
        <span className="flex min-w-0 flex-col items-start">
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          {inlineStatusLabel ? (
            <span className="min-w-0 text-xs font-normal text-muted-foreground">
              {inlineStatusLabel}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
});

const HeaderSubtitleRow = memo(function HeaderSubtitleRow({
  items,
}: {
  items: HeaderSubtitleEntry[];
}) {
  return (
    <TooltipProvider>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center gap-3">
            {index > 0 && <span className="h-4 w-px bg-border" aria-hidden="true" />}
            <HeaderSubtitleItem
              icon={item.icon}
              label={item.label}
              onClick={item.onClick}
              tooltip={item.tooltip}
              className="text-muted-foreground"
            />
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
});

const HEADER_ICON_MAP: Record<string, LucideIcon> = {
  saved: Bookmark,
  'next-session': Clock,
  'last-seen': Clock,
  homework: ClipboardCheck,
  'session-summary': FileText,
};

const getOtherParticipant = (participants: UserProfileVM[], currentUserId: string) =>
  participants.find((participant) => participant.ids.id !== currentUserId) ??
  participants[0];

const PARTICIPANT_ROLE_ICON_MAP: Record<UserProfileVM['kind'], LucideIcon> = {
  educator: Presentation,
  guardian: ShieldUser,
  child: User,
  staff: BriefcaseBusiness,
  system: Sparkles,
};

const CLASSROOM_PARTICIPANT_GROUP_ORDER: UserProfileVM['kind'][] = [
  'educator',
  'guardian',
  'child',
  'staff',
  'system',
];

function buildClassroomParticipantSubtitle(
  participants: UserProfileVM[],
  currentUserId: string,
): ReactNode | null {
  const visibleParticipants = participants.filter(
    (participant) => participant.ids.id !== currentUserId,
  );

  if (visibleParticipants.length === 0) {
    return null;
  }

  const groupedParticipants = CLASSROOM_PARTICIPANT_GROUP_ORDER.map((kind) => ({
    kind,
    participants: visibleParticipants.filter((participant) => participant.kind === kind),
  })).filter((group) => group.participants.length > 0);

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      {groupedParticipants.map((group) => {
        const Icon = PARTICIPANT_ROLE_ICON_MAP[group.kind];
        const displayNames = group.participants
          .map((participant) =>
            getProfileDisplayName(
              participant.profile,
              participant.kind === 'child' ? 'Student' : 'Participant',
            ),
          )
          .filter(Boolean)
          .join(', ');

        return (
          <span
            key={group.kind}
            className="inline-flex min-w-0 items-center gap-1 text-muted-foreground"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">{getAvatarRoleLabel(group.kind)}:</span>
            <span className="truncate">{displayNames}</span>
          </span>
        );
      })}
    </span>
  );
}

function formatRelativeLastSeen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function formatLocalTime(timezone: string | null | undefined): string | null {
  const tz = timezone?.trim();
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    }).format(new Date());
  } catch {
    return null;
  }
}

export const MessagesContainerHeader = memo(function MessagesContainerHeader({
  channel,
}: MessagesContainerHeaderProps) {
  const { savedCount, currentUserId, toggle, messageFilter, toggleMessageFilter } =
    useMessagesState();

  const otherParticipant = useMemo(
    () =>
      channel.basics.kind === 'dm'
        ? getOtherParticipant(channel.collections.participants, currentUserId)
        : null,
    [channel.basics.kind, channel.collections.participants, currentUserId],
  );

  const otherParticipantName =
    otherParticipant && channel.basics.topic
      ? getProfileDisplayName(otherParticipant.profile, channel.basics.topic ?? 'User')
      : otherParticipant
        ? getProfileDisplayName(otherParticipant.profile)
        : channel.basics.topic;
  const title =
    channel.basics.kind === 'dm' ? otherParticipantName : channel.basics.topic;
  const leading = useMemo(() => {
    if (channel.basics.kind === 'dm') {
      if (!otherParticipant) return null;
      return (
        <button
          type="button"
          onClick={() => toggle({ key: 'profile', userId: otherParticipant.ids.id })}
          className="rounded-full"
          aria-label={`View ${otherParticipantName} profile`}
        >
          <AvatarWithStatus
            accountId={otherParticipant.ids.accountId}
            profileId={otherParticipant.ids.id}
            name={otherParticipantName}
            avatar={otherParticipant.profile.avatar}
            presence={otherParticipant.presence}
            themeKey={otherParticipant.ui?.themeKey}
            roleLabel={getAvatarRoleLabel(otherParticipant.kind)}
            timezone={otherParticipant.prefs?.timezone ?? null}
            locationLabel={getAvatarLocationLabel(otherParticipant.location)}
            about={otherParticipant.profile.bio ?? null}
            sizeClassName="h-8 w-8"
          />
        </button>
      );
    }
    const Icon = getChannelTopicIcon(channel.basics.iconKey, Sparkles);
    return (
      <ThemedIconBadge icon={Icon} themeKey={channel.ui?.themeKey ?? null} size="sm" />
    );
  }, [
    channel.basics.kind,
    channel.basics.iconKey,
    channel.ui?.themeKey,
    otherParticipant,
    otherParticipantName,
    toggle,
  ]);

  const subtitleItems: HeaderSubtitleEntry[] = useMemo(() => {
    const quickMetaItems = (channel.ui?.headerQuickMetaActions ?? []).map((item) => ({
      icon: HEADER_ICON_MAP[item.key],
      label:
        item.key === 'saved'
          ? `${savedCount}`
          : item.key === 'homework'
            ? 'HW'
            : item.key === 'session-summary'
              ? 'SS'
              : item.label,
      tooltip: item.tooltip ?? undefined,
      onClick:
        item.key === 'saved'
          ? () => toggle({ key: 'saved' })
          : item.key === 'homework'
            ? () => toggleMessageFilter('homework')
            : item.key === 'session-summary'
              ? () => toggleMessageFilter('session-summary')
              : undefined,
      isActive:
        item.key === 'homework'
          ? messageFilter === 'homework'
          : item.key === 'session-summary'
            ? messageFilter === 'session-summary'
            : undefined,
    }));

    return quickMetaItems;
  }, [
    channel.ui?.headerQuickMetaActions,
    savedCount,
    toggle,
    toggleMessageFilter,
    messageFilter,
  ]);
  const inlineStatusLabel = useMemo(() => {
    if (channel.basics.kind === 'dm') {
      const summary =
        otherParticipant?.presence?.displayStatus === 'online'
          ? 'Available'
          : (() => {
              const relative = formatRelativeLastSeen(
                otherParticipant?.presence?.lastSeenAt,
              );
              return relative ? `Last seen ${relative}` : null;
            })();
      const localTime = formatLocalTime(otherParticipant?.prefs?.timezone);
      if (summary && localTime) {
        return `${summary} · ${localTime} (Local time)`;
      }
      return summary ?? (localTime ? `${localTime} (Local time)` : null);
    }

    if (channel.basics.purpose === 'learning-space') {
      return buildClassroomParticipantSubtitle(
        channel.collections.participants,
        currentUserId,
      );
    }

    return null;
  }, [
    channel.basics.kind,
    channel.basics.purpose,
    channel.collections.participants,
    currentUserId,
    otherParticipant?.presence?.displayStatus,
    otherParticipant?.presence?.lastSeenAt,
    otherParticipant?.prefs?.timezone,
  ]);

  return (
    <div className="flex min-w-0 flex-col">
      <HeaderTitle
        title={title}
        inlineStatusLabel={inlineStatusLabel}
        leading={leading}
        onClick={
          channel.basics.kind === 'dm' && otherParticipant
            ? () => toggle({ key: 'profile', userId: otherParticipant.ids.id })
            : undefined
        }
        ariaLabel={
          channel.basics.kind === 'dm' && otherParticipant
            ? `View ${otherParticipantName} profile`
            : undefined
        }
      />
      {subtitleItems.length ? <HeaderSubtitleRow items={subtitleItems} /> : null}
    </div>
  );
});
