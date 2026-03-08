'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  MessageSquare,
  Paperclip,
  Sparkles,
  UserRoundMinus,
  UserRoundPlus,
  Video,
} from 'lucide-react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
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
  isCollapsed?: boolean;
  showSubActivityToggle?: boolean;
  showActionButton?: boolean;
  subActivityCount?: number;
  hasUnreadSubActivities?: boolean;
  footer?: React.ReactNode;
  className?: string;
};

const READ_ICON_CLASS = 'bg-muted text-muted-foreground';
const INBOX_ICON_MAP: Record<
  InboxIconKeyVM,
  React.ComponentType<{ className?: string }>
> = {
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  MessageSquare,
  Paperclip,
  Sparkles,
  UserRoundMinus,
  UserRoundPlus,
  Video,
};

const TONE_CLASSNAMES = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-blue-100 text-blue-700',
};

const getDefaultIconKey = (activity: ActivityFeedItemVM): InboxIconKeyVM => {
  if (activity.kind === 'group') {
    switch (activity.grouping?.groupType) {
      case 'payment':
        return 'CreditCard';
      case 'survey':
        return 'ClipboardCheck';
      case 'complete-class':
        return 'CheckCircle2';
      case 'reminder':
        return 'Bell';
      case 'recording':
        return 'Video';
      case 'notes':
        return 'FileText';
      case 'ai-summary':
        return 'Sparkles';
      case 'homework':
        return 'Paperclip';
      case 'message':
        return 'MessageSquare';
      case 'class':
        return 'GraduationCap';
      default:
        return 'Bell';
    }
  }

  switch (activity.verb) {
    case 'homework.assigned':
    case 'homework.submitted':
    case 'homework.reviewed':
      return 'Paperclip';
    case 'summary.posted':
      return 'Sparkles';
    case 'notes.posted':
    case 'file.uploaded':
    case 'file.deleted':
      return 'FileText';
    case 'message.posted':
    case 'message.edited':
    case 'message.deleted':
      return 'MessageSquare';
    case 'reaction.added':
    case 'reaction.removed':
      return 'Bell';
    case 'session.scheduled':
      return 'CalendarDays';
    case 'session.rescheduled':
      return 'CalendarCheck';
    case 'session.canceled':
      return 'CalendarX';
    case 'session.completed':
    case 'class.created':
    case 'class.updated':
      return 'GraduationCap';
    case 'member.invited':
    case 'members.invited':
      return 'UserRoundPlus';
    case 'member.removed':
    case 'members.removed':
      return 'UserRoundMinus';
    case 'member.joined':
    case 'role.changed':
      return 'CheckCircle2';
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
  isCollapsed = false,
  showSubActivityToggle = false,
  showActionButton = false,
  subActivityCount,
  hasUnreadSubActivities = false,
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
  const Icon = INBOX_ICON_MAP[iconKey];
  const timestampLabel = formatRelativeTime(activity.timestamps.occurredAt);
  const secondaryHref = activity.content.actionButton?.href ?? undefined;
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
            }, 900);
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
          <div
            className={cn(
              'z-10 flex size-6 items-center justify-center rounded-full',
              activity.state?.isRead ? READ_ICON_CLASS : toneClassName,
              !toneClassName && !activity.state?.isRead && READ_ICON_CLASS,
            )}
          >
            {Icon ? <Icon className="size-3" /> : null}
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
          onToggle && showSubActivityToggle && !isCollapsed && 'bg-muted/30',
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

            {showSubActivityToggle && (
              <>
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px] h-4 px-1.5 gap-1"
                >
                  {hasUnreadSubActivities ? (
                    <span
                      className="size-1.5 rounded-full bg-rose-500"
                      aria-label="Unread sub activities"
                    />
                  ) : null}
                  {subActivityCount ?? 0}
                </Badge>
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    !isCollapsed && 'rotate-180',
                  )}
                />
              </>
            )}
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
