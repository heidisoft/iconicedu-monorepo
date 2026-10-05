'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import { cn } from '@iconicedu/ui-web/lib/utils';

export function ZoomMeetingSideDock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'zoom-toolbar-side-actions absolute right-0 flex items-center gap-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ZoomMeetingDockButton({
  label,
  count,
  active,
  attention = false,
  compact = false,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, 'aria-label' | 'variant'> & {
  label: string;
  count?: number;
  active: boolean;
  attention?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      {...props}
      type="button"
      variant={active ? 'default' : 'meeting'}
      className={cn(
        'rounded-full',
        compact ? 'h-9 gap-1.5 px-2 sm:h-10' : 'h-10 px-2.5 sm:h-12 sm:px-3',
        className,
      )}
      aria-label={label}
    >
      {children}
      {count !== undefined ? (
        <Badge
          variant={attention ? 'destructive' : 'secondary'}
          className={cn(
            'rounded-full text-xs tabular-nums',
            compact ? 'h-5 min-w-6 px-1.5 text-[11px]' : 'h-6 min-w-7 px-2',
          )}
        >
          {count}
        </Badge>
      ) : null}
    </Button>
  );
}
