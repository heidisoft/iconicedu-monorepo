'use client';

import { useState } from 'react';
import { Clock3, Loader2, MessageSquareText, Video } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { useOptionalMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/use-external-live-session-join-dialog';
import type { ClassSession } from './messages-schedule-tab.utils';

interface SessionCardProps {
  session: ClassSession;
  index: number;
  canJoin?: boolean;
  showJoinButton?: boolean;
  actionOrder?: 'message-first' | 'join-first';
  joinLiveSession?: () => Promise<void>;
  /**
   * Channel-level fallback link, used only when the occurrence carries no
   * meeting link and no join handler is wired up.
   */
  joinHref?: string | null;
  classroomChatHref?: string;
  openClassroomChat?: () => Promise<void> | void;
}

export function getSessionCardState(session: ClassSession): {
  isLive: boolean;
  isPast: boolean;
  isDisabled: boolean;
} {
  const isPast = session.isPast;
  return {
    isPast,
    isDisabled: Boolean(session.disabled),
    isLive: session.isLive && !isPast,
  };
}

export function isSessionJoinButtonDisabled(input: {
  session: ClassSession;
  hasJoinAction: boolean;
  isJoinPending: boolean;
  canJoin: boolean;
}): boolean {
  const { isPast, isDisabled } = getSessionCardState(input.session);
  if (isPast || isDisabled) {
    return true;
  }
  return !input.canJoin || !input.hasJoinAction || input.isJoinPending;
}

export function SessionCard({
  session,
  canJoin = false,
  showJoinButton = true,
  actionOrder = 'message-first',
  joinLiveSession: joinLiveSessionOverride,
  joinHref: configuredJoinHref,
  classroomChatHref,
  openClassroomChat,
}: SessionCardProps) {
  const { isLive, isPast, isDisabled } = getSessionCardState(session);
  const messagesState = useOptionalMessagesState();
  const joinLiveSession = joinLiveSessionOverride ?? messagesState?.joinLiveSession;
  const [isJoinPending, setIsJoinPending] = useState(false);
  const { externalJoinTarget, closeExternalJoinDialog, handleResolvedJoinHref } =
    useExternalLiveSessionJoinDialog();
  const occurrenceJoinHref = session.meetingLink?.trim() || null;
  const isJoinButtonDisabled = isSessionJoinButtonDisabled({
    session,
    hasJoinAction: Boolean(occurrenceJoinHref || joinLiveSession || configuredJoinHref),
    isJoinPending,
    canJoin,
  });
  const separatorIndex = session.time.indexOf(' · ');
  const timeLabel =
    separatorIndex === -1 ? session.time : session.time.slice(0, separatorIndex);
  const participantLabel =
    separatorIndex === -1 ? null : session.time.slice(separatorIndex + 3);
  const canOpenClassroomChat = Boolean(classroomChatHref || openClassroomChat);
  const joinButton = showJoinButton ? (
    <Button
      size="sm"
      className={cn(
        'gap-1.5 rounded-full text-xs font-semibold',
        isLive
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-primary/10 text-primary hover:bg-primary/20',
      )}
      variant="default"
      disabled={isJoinButtonDisabled}
      onClick={() => void handleJoin()}
    >
      <span className="inline-flex items-center gap-1.5">
        {isJoinPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Video className="size-3.5" />
        )}
        {isLive ? 'Join Now' : 'Join'}
      </span>
    </Button>
  ) : null;
  const messageButton = canOpenClassroomChat ? (
    <Button
      size="sm"
      variant="outline"
      aria-label="Message"
      className="size-8 rounded-full p-0"
      onClick={() => void handleOpenClassroomChat()}
    >
      <MessageSquareText className="size-3.5" />
    </Button>
  ) : null;
  const handleJoin = async () => {
    if (isJoinPending) {
      return;
    }
    // Precedence: this occurrence's own link, then the server join handler
    // (which creates or reuses the live session and records attendance), then
    // the channel-level fallback link.
    if (occurrenceJoinHref) {
      handleResolvedJoinHref(occurrenceJoinHref);
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
    if (configuredJoinHref) {
      handleResolvedJoinHref(configuredJoinHref);
    }
  };

  const handleOpenClassroomChat = async () => {
    if (openClassroomChat) {
      await openClassroomChat();
      return;
    }
    if (classroomChatHref) {
      window.location.assign(classroomChatHref);
    }
  };

  return (
    <>
      <div
        data-classroom-theme={session.themeKey ?? 'default'}
        className={cn(
          'group relative flex items-center gap-4 rounded-2xl border border-transparent px-4 py-3.5 transition-all',
          isDisabled
            ? 'bg-muted/25 opacity-75'
            : isLive
              ? 'border-primary/30 bg-primary/5 shadow-sm shadow-primary/10'
              : isPast
                ? 'bg-muted/40'
                : 'bg-card shadow-soft hover:shadow-soft-lg',
        )}
      >
        <div
          className={cn(
            'flex min-w-[4.5rem] flex-col items-center rounded-xl px-3 py-2',
            isDisabled
              ? 'bg-muted/70 text-muted-foreground'
              : isLive
                ? 'bg-primary text-primary-foreground'
                : isPast
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-ink-subtle text-foreground',
          )}
        >
          {isLive ? (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
              Today
            </span>
          ) : null}
          <span className="text-xs font-medium">{session.dayName}</span>
          <span className="text-sm font-bold leading-tight">{session.dayNum}</span>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                'text-sm font-semibold',
                isDisabled || isPast ? 'text-muted-foreground' : 'text-card-foreground',
              )}
            >
              {session.label}
            </h3>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-[10px] font-semibold text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Live
              </span>
            ) : null}
            {session.variant === 'exception' ? (
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                Skipped
              </Badge>
            ) : null}
            {session.variant === 'override' ? (
              <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                Changed
              </Badge>
            ) : null}
            {isPast && session.variant !== 'exception' ? (
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                Completed
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3" />
            <span>{timeLabel}</span>
            {participantLabel ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-primary">{participantLabel}</span>
              </>
            ) : null}
          </div>
          {session.variant === 'override' && session.originalTime ? (
            <>
              <p className="text-xs text-muted-foreground">
                Was{' '}
                <span className="line-through">
                  {session.originalDate ? `${session.originalDate} ` : ''}
                  {session.originalTime}
                </span>
              </p>
            </>
          ) : null}
          {session.variant === 'exception' && session.reason ? (
            <p className="text-xs text-muted-foreground">{session.reason}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {!isPast && !isDisabled ? (
            <>
              {actionOrder === 'join-first' ? (
                <>
                  {joinButton}
                  {messageButton}
                </>
              ) : (
                <>
                  {messageButton}
                  {joinButton}
                </>
              )}
            </>
          ) : isDisabled ? (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs text-muted-foreground"
              disabled
            >
              <Video className="size-3.5" />
              Unavailable
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <Video className="size-3.5" />
              Recording
            </Button>
          )}
        </div>
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
}
