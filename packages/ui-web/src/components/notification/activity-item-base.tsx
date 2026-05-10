'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import {
  AtSign,
  Bell,
  BookImage,
  CalendarCheck,
  CalendarX,
  Check,
  CreditCard,
  FileBadge,
  FileHeadphone,
  GraduationCap,
  MessageSquare,
  MessageSquareDot,
  MessageSquareHeart,
  MessageSquareReply,
  MessagesSquare,
  SmilePlus,
} from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { ActivityBadge } from '@iconicedu/ui-web/components/notification/activity-badge';
import { ActivityWithButton } from '@iconicedu/ui-web/components/notification/activity-with-button';
import type { ActivityFeedItemVM, InboxIconKeyVM } from '@iconicedu/shared-types';

type ActivityItemBaseProps = {
  activity: ActivityFeedItemVM;
  onMarkRead: (id: string, event: React.MouseEvent) => void;
  onAutoRead?: (id: string) => void;
  onToggle?: (event: React.MouseEvent) => void;
  isSubActivity?: boolean;
  parentExpanded?: boolean;
  showActionButton?: boolean;
  showTimelineConnector?: boolean;
  footer?: React.ReactNode;
  className?: string;
};

const READ_ICON_CLASS = 'bg-muted text-muted-foreground';
const UNREAD_ICON_CLASS = 'bg-sky-100 text-sky-700';
const AUTO_READ_VIEW_DELAY_MS = 2000;
const INBOX_ICON_MAP: Record<
  InboxIconKeyVM,
  React.ComponentType<{ className?: string }>
> = {
  AtSign,
  Bell,
  BookImage,
  CalendarCheck,
  CalendarX,
  CreditCard,
  FileBadge,
  FileHeadphone,
  GraduationCap,
  MessageSquare,
  MessageSquareDot,
  MessageSquareHeart,
  MessageSquareReply,
  MessagesSquare,
  SmilePlus,
};

const TONE_CLASSNAMES = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-blue-100 text-blue-700',
};

const getDefaultIconKey = (activity: ActivityFeedItemVM): InboxIconKeyVM => {
  switch (activity.verb) {
    case 'message.posted':
      return 'MessageSquareDot';
    case 'message.mentioned':
      return 'AtSign';
    case 'message.thread_reply.posted':
      return 'MessageSquareReply';
    case 'file.uploaded':
      return 'FileBadge';
    case 'image.uploaded':
      return 'BookImage';
    case 'audio.uploaded':
      return 'FileHeadphone';
    case 'reaction.added':
      return 'SmilePlus';
    case 'class.session.rescheduled':
      return 'CalendarCheck';
    case 'class.session.canceled':
      return 'CalendarX';
    case 'session.reminder.sent':
      return 'Bell';
    case 'session.feedback_request.sent':
      return 'MessageSquareHeart';
    default:
      return 'Bell';
  }
};

const formatRelativeTime = (occurredAt: string) => {
  const timestamp = new Date(occurredAt).getTime();
  if (Number.isNaN(timestamp)) return '';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

export function ActivityItemBase({
  activity,
  onMarkRead,
  onAutoRead,
  onToggle,
  isSubActivity = false,
  parentExpanded = false,
  showActionButton = false,
  showTimelineConnector = false,
  footer,
  className,
}: ActivityItemBaseProps) {
  const iconKey =
    activity.content.leading?.kind === 'icon'
      ? activity.content.leading.iconKey
      : getDefaultIconKey(activity);
  const toneClassName =
    activity.content.leading?.kind === 'icon' && activity.content.leading.tone
      ? TONE_CLASSNAMES[activity.content.leading.tone]
      : undefined;
  const iconColorClass = activity.state?.isRead
    ? READ_ICON_CLASS
    : (toneClassName ?? UNREAD_ICON_CLASS);
  const Icon = INBOX_ICON_MAP[iconKey];
  const timestampLabel = formatRelativeTime(activity.timestamps.occurredAt);
  const secondaryHref =
    activity.content.headline.secondaryHref ??
    activity.content.actionButton?.href ??
    undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const autoReadTriggeredRef = useRef(false);

  useEffect(() => {
    autoReadTriggeredRef.current = false;
  }, [activity.ids.id]);

  useEffect(() => {
    if (!onAutoRead || activity.state?.isRead || autoReadTriggeredRef.current) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const node = rootRef.current;
    if (!node) {
      return;
    }

    let readTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!readTimer) {
            readTimer = setTimeout(() => {
              autoReadTriggeredRef.current = true;
              onAutoRead(activity.ids.id);
            }, AUTO_READ_VIEW_DELAY_MS);
          }
          return;
        }

        if (readTimer) {
          window.clearTimeout(readTimer);
          readTimer = null;
        }
      },
      { threshold: [0.6] },
    );

    observer.observe(node);

    return () => {
      if (readTimer) {
        window.clearTimeout(readTimer);
      }
      observer.disconnect();
    };
  }, [activity.ids.id, activity.state?.isRead, onAutoRead]);

  return (
    <div
      ref={rootRef}
      data-activity-id={activity.ids.id}
      className={cn(
        'flex flex-col gap-2 py-2.5 md:flex-row md:items-start md:gap-3',
        className,
      )}
    >
      <div className="flex items-center gap-2 md:flex-row md:items-start">
        <div className="relative flex shrink-0 flex-col items-center">
          {showTimelineConnector ? (
            <div
              aria-hidden
              className="absolute left-1/2 top-7 hidden h-[calc(100%+1rem)] w-px -translate-x-1/2 rounded-full bg-border/80 md:block"
            />
          ) : null}
          <div
            className={cn(
              'z-10 flex size-6 items-center justify-center rounded-full transition-colors duration-300 ease-out',
              iconColorClass,
            )}
          >
            {Icon ? (
              <Icon className="size-3 transition-colors duration-300 ease-out" />
            ) : null}
          </div>
        </div>

        <div className="text-xs text-muted-foreground md:pt-0.5 md:w-12 md:shrink-0 text-center">
          {timestampLabel}
        </div>
        {!isSubActivity && <div className="h-px flex-1 bg-border md:hidden" />}
      </div>

      <div
        onClick={onToggle}
        className={cn(
          'group relative z-10 flex min-w-0 flex-1 items-start gap-2.5 rounded-md px-2 py-1 -mx-2 transition-all duration-200',
          onToggle && !isSubActivity && 'cursor-pointer hover:bg-muted/50',
          isSubActivity && parentExpanded && 'bg-muted/30',
        )}
      >
        <ActivityBadge activity={activity} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-sm leading-tight text-pretty">
              <span className="font-semibold text-foreground">
                {activity.content.headline.primary}
              </span>{' '}
              {activity.content.headline.secondary &&
                (secondaryHref ? (
                  <a
                    href={secondaryHref}
                    className="text-muted-foreground underline-offset-2 hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    {activity.content.headline.secondary}
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    {activity.content.headline.secondary}
                  </span>
                ))}{' '}
              {activity.content.headline.emphasis && (
                <span className="font-medium text-foreground">
                  {activity.content.headline.emphasis}
                </span>
              )}
            </p>

            {!activity.state?.isRead && (
              <Button
                size="icon"
                variant="ghost"
                className="size-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(event) => onMarkRead(activity.ids.id, event)}
                data-action-button="true"
              >
                <Check className="size-3.5" />
              </Button>
            )}

            {isSubActivity && !activity.state?.isRead ? (
              <span
                className="inline-flex size-1.5 shrink-0 rounded-full bg-rose-500"
                aria-label="Unread"
                title="Unread"
              />
            ) : null}
          </div>

          {showActionButton && <ActivityWithButton activity={activity} />}

          {activity.content.summary && !footer ? (
            <p className="text-xs text-muted-foreground">{activity.content.summary}</p>
          ) : null}

          {footer}
        </div>
      </div>
    </div>
  );
}
