'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';

/** Theme-aware floating notice with compact actions and readable wrapping. */
export function NotificationCard({
  title,
  message,
  icon,
  action,
  onDismiss,
  dismissLabel = 'Dismiss message',
  role = 'status',
  className,
}: {
  title?: string;
  message: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  dismissLabel?: string;
  role?: 'alert' | 'status';
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        'pointer-events-auto flex w-fit max-w-md flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border border-border/60 bg-popover/95 px-3 py-2.5 text-popover-foreground shadow-sm backdrop-blur-md',
        className,
      )}
    >
      <div className="flex min-w-0 flex-[1_1_auto] items-center gap-2.5">
        {icon ? (
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 [&_svg]:size-4"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 break-words text-sm leading-5">
          {title ? <p className="font-medium">{title}</p> : null}
          <p className={cn(title ? 'mt-0.5 text-muted-foreground' : 'font-normal')}>
            {message}
          </p>
        </div>
      </div>
      {action || onDismiss ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {action ? (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg px-3 font-medium"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ) : null}
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 rounded-lg focus-visible:ring-2"
              aria-label={dismissLabel}
              onClick={onDismiss}
            >
              <X className="size-4 text-muted-foreground" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
