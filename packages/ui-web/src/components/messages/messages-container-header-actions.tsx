'use client';

import { memo } from 'react';
import type { CSSProperties } from 'react';
import { Bookmark, Flag, Info, LifeBuoy, LogOut, MoreHorizontal, Video } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import type { ChannelHeaderActionVM, ChannelQuickActionVM } from '@iconicedu/shared-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';

const ActionButton = memo(function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
  themeKey,
  useThemeHover,
}: {
  icon: typeof Info;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  themeKey?: string | null;
  useThemeHover?: boolean;
}) {
  const themeClass = themeKey ? `theme-${themeKey}` : '';
  const themeHoverStyle = useThemeHover
    ? ({
        ['--theme-hover' as string]:
          'color-mix(in oklab, var(--theme-bg) 18%, transparent)',
      } as CSSProperties)
    : undefined;
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'group h-9 w-9 text-muted-foreground',
        active && 'text-primary',
      )}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full bg-muted',
          active && 'bg-primary/10',
          useThemeHover && themeClass,
          useThemeHover &&
            'group-hover:bg-[var(--theme-hover)] group-hover:text-[var(--theme-bg)]',
        )}
        style={themeHoverStyle}
      >
        <Icon className="h-4 w-4" />
      </span>
    </Button>
  );
});

export function getVisibleHeaderActions(
  actions?: ChannelHeaderActionVM[] | null,
): ChannelHeaderActionVM[] {
  return actions?.filter((action) => !action.hidden && action.key !== 'info') ?? [];
}

export function getHeaderJoinQuickAction(
  quickActions?: ChannelQuickActionVM[] | null,
): ChannelQuickActionVM | null {
  return (
    quickActions?.find((action) => action.key === 'join' && !action.hidden) ?? null
  );
}

export function resolveHeaderJoinQuickAction(
  quickActions: ChannelQuickActionVM[] | null | undefined,
  showFallback: boolean,
): ChannelQuickActionVM | null {
  const existingJoinAction = getHeaderJoinQuickAction(quickActions);
  if (existingJoinAction) {
    return existingJoinAction;
  }
  if (!showFallback) {
    return null;
  }
  return {
    key: 'join',
    label: 'Join',
    isPrimary: true,
  };
}

export const MessagesContainerHeaderActions = memo(
  function MessagesContainerHeaderActions() {
    const { toggle, isActive, channel, currentUserId } = useMessagesState();
    const otherParticipant =
      channel.basics.kind === 'dm'
        ? channel.collections.participants.find(
            (participant) => participant.ids.id !== currentUserId,
          )
        : null;
    const actions = getVisibleHeaderActions(channel.ui?.headerActions);
    const joinQuickAction = resolveHeaderJoinQuickAction(
      channel.ui?.quickActions,
      channel.basics.kind !== 'dm',
    );

    const iconMap: Record<string, typeof Info> = {
      info: Info,
      saved: Bookmark,
      support: LifeBuoy,
      'life-buoy': LifeBuoy,
    };

    return (
      <div className="flex items-center gap-2">
        {actions.map((action, index) => {
          const key = action.iconKey ?? action.key;
          const Icon = iconMap[key ?? 'info'] ?? Info;
          const resolvedIntentKey =
            action.key === 'info'
              ? channel.basics.kind === 'dm'
                ? 'profile'
                : 'channel_info'
              : action.intentKey ?? (action.key === 'saved' ? 'saved' : 'channel_info');
          const intent =
            resolvedIntentKey === 'profile' && otherParticipant
              ? ({ key: 'profile', userId: otherParticipant.ids.id } as const)
              : resolvedIntentKey === 'saved'
                ? ({ key: 'saved' } as const)
                : ({ key: 'channel_info' } as const);
          const isProfileIntent =
            resolvedIntentKey === 'profile' || action.key === 'info';
          const useThemeHover =
            action.key === 'info' &&
            channel.basics.purpose === 'learning-space' &&
            !!channel.ui?.themeKey;
          const active = isProfileIntent
            ? isActive('profile', {
                key: 'profile',
                userId: otherParticipant?.ids.id ?? '',
              })
            : resolvedIntentKey === 'saved'
              ? isActive('saved')
              : isActive('channel_info');
          const disabled = resolvedIntentKey === 'profile' && !otherParticipant;

          return (
            <ActionButton
              key={`${action.key}-${index}`}
              icon={Icon}
              label={action.label}
              active={active}
              onClick={() => toggle(intent)}
              disabled={disabled}
              themeKey={channel.ui?.themeKey ?? null}
              useThemeHover={useThemeHover}
            />
          );
        })}
        {joinQuickAction ? (
          joinQuickAction.url ? (
            <Button size="sm" asChild>
              <a href={joinQuickAction.url} target="_blank" rel="noreferrer">
                <Video className="h-4 w-4" />
                {joinQuickAction.label}
              </a>
            </Button>
          ) : (
            <Button size="sm" disabled>
              <Video className="h-4 w-4" />
              {joinQuickAction.label}
            </Button>
          )
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <span>Leave</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Flag className="h-4 w-4 text-muted-foreground" />
              <span>Report</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);
