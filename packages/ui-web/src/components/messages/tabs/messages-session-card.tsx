'use client';

import { CalendarPlus, ChevronRight, Clock3, Video } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type { ClassSession } from './messages-schedule-tab.utils';

interface SessionCardProps {
  session: ClassSession;
  index: number;
}

export function getSessionCardState(session: ClassSession): {
  isLive: boolean;
  isPast: boolean;
} {
  const isPast = session.isPast;
  return {
    isPast,
    isLive: session.isToday && !isPast,
  };
}

export function SessionCard({ session }: SessionCardProps) {
  const { isLive, isPast } = getSessionCardState(session);

  return (
    <div
      className={cn(
        'group relative flex items-center gap-4 rounded-xl border px-4 py-3 transition-all',
        isLive
          ? 'border-primary/30 bg-primary/5 shadow-sm shadow-primary/10'
          : isPast
            ? 'border-border/50 bg-muted/40'
            : 'border-border bg-card hover:border-primary/20 hover:shadow-sm',
      )}
    >
      <div
        className={cn(
          'flex min-w-[4.5rem] flex-col items-center rounded-lg px-3 py-2',
          isLive
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
              isPast ? 'text-muted-foreground' : 'text-card-foreground',
            )}
          >
            {session.label}
          </h3>
          {isLive ? (
            <Badge className="animate-pulse bg-primary px-1.5 py-0 text-[10px] font-semibold text-primary-foreground">
              LIVE
            </Badge>
          ) : null}
          {isPast ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Completed
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3" />
          <span>{session.time}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isPast ? (
          <Button
            size="sm"
            className={cn(
              'gap-1.5 rounded-full text-xs font-semibold',
              isLive
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-primary/10 text-primary hover:bg-primary/20',
            )}
            variant="default"
            asChild={Boolean(session.meetingLink)}
            disabled={!session.meetingLink}
          >
            {session.meetingLink ? (
              <a
                href={session.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <Video className="size-3.5" />
                {isLive ? 'Join Now' : 'Join'}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Video className="size-3.5" />
                Join
              </span>
            )}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground">
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
