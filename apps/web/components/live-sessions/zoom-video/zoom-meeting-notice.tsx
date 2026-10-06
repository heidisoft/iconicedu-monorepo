'use client';

import { CircleAlert, TriangleAlert, X } from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import { cn } from '@iconicedu/ui-web/lib/utils';

export type MeetingNoticeModel = {
  message: string;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
  tone?: 'error' | 'warning';
};

export function ZoomMeetingNotice({
  message,
  onDismiss,
  action,
  className,
  tone = 'error',
}: MeetingNoticeModel & { className?: string }) {
  const Icon = tone === 'warning' ? TriangleAlert : CircleAlert;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border bg-popover/95 px-4 py-3 text-sm text-popover-foreground shadow-lg backdrop-blur-sm',
          tone === 'warning' ? 'border-warning/50' : 'border-destructive/40',
        )}
        role={tone === 'error' ? 'alert' : 'status'}
      >
        <Icon
          className={cn(
            'size-5 shrink-0',
            tone === 'warning' ? 'text-warning' : 'text-destructive',
          )}
        />
        <p className="min-w-0 flex-1 leading-5">{message}</p>
        {action ? (
          <Button type="button" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
        {onDismiss ? (
          <IconActionButton
            variant="ghost"
            size="icon-sm"
            label="Dismiss message"
            onClick={onDismiss}
          >
            <X />
          </IconActionButton>
        ) : null}
      </div>
    </div>
  );
}
