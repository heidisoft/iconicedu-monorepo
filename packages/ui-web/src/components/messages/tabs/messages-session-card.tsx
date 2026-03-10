'use client';

import { useState } from 'react';
import { CalendarPlus, ChevronRight, Clock3, Loader2, Video } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { useMessagesState } from '../context/messages-state-provider';
import type { ClassSession } from './messages-schedule-tab.utils';

interface SessionCardProps {
  session: ClassSession;
  index: number;
  canJoin?: boolean;
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
  hasJoinLiveSession: boolean;
  isJoinPending: boolean;
  canJoin: boolean;
}): boolean {
  const { isPast, isDisabled } = getSessionCardState(input.session);
  if (isPast || isDisabled) {
    return true;
  }
  return !input.canJoin || !input.hasJoinLiveSession || input.isJoinPending;
}

export function SessionCard({ session, canJoin = false }: SessionCardProps) {
  const { isLive, isPast, isDisabled } = getSessionCardState(session);
  const { joinLiveSession } = useMessagesState();
  const [isJoinPending, setIsJoinPending] = useState(false);
  const isJoinButtonDisabled = isSessionJoinButtonDisabled({
    session,
    hasJoinLiveSession: Boolean(joinLiveSession),
    isJoinPending,
    canJoin,
  });

  const handleJoin = async () => {
    if (!joinLiveSession || isJoinPending) {
      return;
    }
    setIsJoinPending(true);
    try {
      await joinLiveSession();
    } finally {
      setIsJoinPending(false);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex items-center gap-4 rounded-xl border px-4 py-3 transition-all',
        isDisabled
          ? 'border-border/50 bg-muted/25 opacity-75'
          : isLive
            ? 'border-primary/30 bg-primary/5 shadow-sm shadow-primary/10'
            : isPast
              ? 'border-border/50 bg-muted/40'
              : 'border-border bg-card hover:border-primary/20 hover:shadow-sm',
      )}
    >
      <div
        className={cn(
          'flex min-w-[4.5rem] flex-col items-center rounded-lg px-3 py-2',
          isDisabled
            ? 'bg-muted/70 text-muted-foreground'
            : isLive
              ? 'bg-primary text-primary-foreground'
              : isPast
                ? 'bg-muted text-muted-foreground'
                : 'bg-secondary text-secondary-foreground',
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
            <Badge className="animate-pulse bg-primary px-1.5 py-0 text-[10px] font-semibold text-primary-foreground">
              LIVE
            </Badge>
          ) : null}
          {session.variant === 'exception' ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Skipped
            </Badge>
          ) : null}
          {session.variant === 'override' ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              Changed
            </Badge>
          ) : null}
          {isPast && session.variant !== 'exception' ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Completed
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3" />
          <span>{session.time}</span>
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
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Add to calendar"
        >
          <CalendarPlus className="size-4" />
        </Button>
        <ChevronRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
      </div>
    </div>
  );
}
