'use client';

import type { ReactNode } from 'react';
import { CircleX } from 'lucide-react';
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
        'pointer-events-auto flex w-full max-w-xl flex-wrap items-center gap-x-4 gap-y-3 rounded-[1.75rem] border border-border/70 bg-popover/90 px-5 py-4 text-popover-foreground shadow-lg backdrop-blur-2xl',
        className,
      )}
    >
      <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-3">
        {icon ? (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background/60 [&_svg]:size-4"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 break-words text-sm leading-5">
          {title ? <p className="font-semibold">{title}</p> : null}
          <p className={cn(title ? 'mt-0.5 text-muted-foreground' : 'font-medium')}>
            {message}
          </p>
        </div>
      </div>
      {action || onDismiss ? (
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {action ? (
            <Button
              type="button"
              size="sm"
              className="h-10 rounded-full px-5 font-medium"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ) : null}
          {onDismiss ? (
            <span className="inline-flex rounded-full bg-background/90 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 rounded-full focus-visible:ring-2"
                aria-label={dismissLabel}
                onClick={onDismiss}
              >
                <CircleX className="size-5 text-destructive" aria-hidden="true" />
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
