'use client';

import type { ReactNode } from 'react';

import { Badge } from '@iconicedu/ui-web/ui/badge';
import {
  IconActionButton,
  type IconActionButtonProps,
} from '@iconicedu/ui-web/ui/icon-action-button';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { MEETING_TOOLBAR_ICON_CLASS } from './zoom-video-session.constants';

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

export interface ZoomMeetingDockButtonProps extends Omit<
  IconActionButtonProps,
  'variant'
> {
  count?: number;
  active: boolean;
  attention?: boolean;
  compact?: boolean;
}

export function ZoomMeetingDockButton({
  label,
  count,
  active,
  attention = false,
  compact = false,
  size = 'default',
  className,
  children,
  ...props
}: ZoomMeetingDockButtonProps) {
  return (
    <IconActionButton
      {...props}
      size={size}
      variant={active ? 'default' : 'meeting'}
      className={cn(
        'rounded-full',
        MEETING_TOOLBAR_ICON_CLASS,
        compact ? 'h-9 gap-1.5 px-2 sm:h-10' : 'h-10 px-2.5 sm:h-12 sm:px-3',
        className,
      )}
      label={label}
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
    </IconActionButton>
  );
}
