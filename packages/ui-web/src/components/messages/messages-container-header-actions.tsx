'use client';

import { memo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Bookmark,
  Flag,
  Info,
  LifeBuoy,
  Loader2,
  LogOut,
  MoreHorizontal,
  Video,
} from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import type {
  ChannelHeaderActionVM,
  ChannelQuickActionVM,
} from '@iconicedu/shared-types';
import {
  getVisibleJoinQuickAction,
  resolveLiveSessionJoinAction,
  resolveLiveSessionJoinHref,
} from '@iconicedu/ui-web/components/messages/live-session-join.utils';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/use-external-live-session-join-dialog';
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
      className={cn('group h-9 w-9 text-muted-foreground', active && 'text-primary')}
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
  return getVisibleJoinQuickAction(quickActions);
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

export function resolveHeaderJoinHref(input: {
  joinQuickAction?: ChannelQuickActionVM | null;
  fallbackUrl?: string | null;
}): string | null {
  return resolveLiveSessionJoinHref({
    quickActions: input.joinQuickAction ? [input.joinQuickAction] : [],
    fallbackUrl: input.fallbackUrl,
  });
}

export const MessagesContainerHeaderActions = memo(
  function MessagesContainerHeaderActions() {
    const { toggle, isActive, channel, currentUserId, joinLiveSession } =
      useMessagesState();
    const [isJoinPending, setIsJoinPending] = useState(false);
    const otherParticipant =
      channel.basics.kind === 'dm'
        ? channel.collections.participants.find(
            (participant) => participant.ids.id !== currentUserId,
          )
        : null;
    const actions = getVisibleHeaderActions(channel.ui?.headerActions);
    const { externalJoinTarget, closeExternalJoinDialog, handleResolvedJoinHref } =
      useExternalLiveSessionJoinDialog();
    const joinAction = resolveLiveSessionJoinAction({
      liveSession: channel.context?.liveSession,
      quickActions: channel.ui?.quickActions,
      hasJoinHandler: Boolean(joinLiveSession),
      allowDefaultAction: true,
    });

    const handleJoin = async () => {
      if (isJoinPending) {
        return;
      }
      if (joinLiveSession) {
        setIsJoinPending(true);
        try {
          await joinLiveSession();
        } finally {
          setIsJoinPending(false);
        }
        return;
      }

      if (joinAction.joinHref) {
        handleResolvedJoinHref(joinAction.joinHref);
      }
    };

    const iconMap: Record<string, typeof Info> = {
      info: Info,
      saved: Bookmark,
      support: LifeBuoy,
      'life-buoy': LifeBuoy,
    };

    return (
      <>
        <div className="flex items-center gap-2">
          {actions.map((action, index) => {
            const key = action.iconKey ?? action.key;
            const Icon = iconMap[key ?? 'info'] ?? Info;
            const resolvedIntentKey =
              action.key === 'info'
                ? channel.basics.kind === 'dm'
                  ? 'profile'
                  : 'channel_info'
                : (action.intentKey ??
                  (action.key === 'saved' ? 'saved' : 'channel_info'));
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
          {joinAction.visible ? (
            <Button size="sm" disabled={isJoinPending} onClick={() => void handleJoin()}>
              {isJoinPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
              {joinAction.label}
            </Button>
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
        <ExternalLiveSessionJoinDialog
          target={externalJoinTarget}
          onOpenChange={(open) => {
            if (!open) {
              closeExternalJoinDialog();
            }
          }}
        />
      </>
    );
  },
);
