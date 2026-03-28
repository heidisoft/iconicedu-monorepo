'use client';

import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  BookOpen,
  Bookmark,
  Calculator,
  ChefHat,
  ChessKnight,
  Clock,
  ClipboardCheck,
  Earth,
  FileText,
  GraduationCap,
  Languages,
  Landmark,
  LifeBuoy,
  Map,
  NotebookPen,
  NotebookText,
  Paintbrush,
  Palette,
  PenTool,
  Ruler,
  Scissors,
  Sparkles,
  SquarePi,
  User,
  Users,
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
  inlineStatusLabel?: string | null;
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
          className="flex min-w-0 flex-col items-start text-sm font-semibold text-foreground hover:underline"
          aria-label={ariaLabel ?? title}
        >
          <span className="truncate">{title}</span>
          {inlineStatusLabel ? (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {inlineStatusLabel}
            </span>
          ) : null}
        </button>
      ) : (
        <span className="flex min-w-0 flex-col items-start">
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
          {inlineStatusLabel ? (
            <span className="truncate text-xs font-normal text-muted-foreground">
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

const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  book: BookOpen,
  user: User,
  users: Users,
  languages: Languages,
  'square-pi': SquarePi,
  'chef-hat': ChefHat,
  earth: Earth,
  'chess-knight': ChessKnight,
  palette: Palette,
  paintbrush: Paintbrush,
  scissors: Scissors,
  calculator: Calculator,
  ruler: Ruler,
  'pen-tool': PenTool,
  'notebook-pen': NotebookPen,
  'notebook-text': NotebookText,
  'clipboard-check': ClipboardCheck,
  'graduation-cap': GraduationCap,
  landmark: Landmark,
  map: Map,
  support: LifeBuoy,
};

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
            name={otherParticipantName}
            avatar={otherParticipant.profile.avatar}
            presence={otherParticipant.presence}
            themeKey={otherParticipant.ui?.themeKey}
            roleLabel={getAvatarRoleLabel(otherParticipant.kind)}
            timezone={otherParticipant.prefs?.timezone ?? null}
            locationLabel={getAvatarLocationLabel(otherParticipant.location)}
            about={otherParticipant.profile.bio ?? null}
            sizeClassName="h-8 w-8"
            initialsLength={1}
          />
        </button>
      );
    }
    const Icon = CHANNEL_ICON_MAP[channel.basics.iconKey ?? ''] ?? Sparkles;
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
    if (channel.basics.kind !== 'dm') {
      return null;
    }
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
  }, [
    channel.basics.kind,
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
