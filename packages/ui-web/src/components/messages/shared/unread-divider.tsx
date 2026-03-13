'use client';

import { memo } from 'react';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface UnreadDividerProps {
  count?: number;
  isDismissing?: boolean;
  className?: string;
}

export const UnreadDivider = memo(function UnreadDivider({
  count,
  isDismissing = false,
  className,
}: UnreadDividerProps) {
  const label = count && count > 0 ? `New messages (${count})` : 'New messages';

  return (
    <div
      data-testid="unread-divider"
      data-dismissing={isDismissing ? 'true' : 'false'}
      className={cn(
        'relative my-4 overflow-hidden transition-all duration-300 ease-out',
        isDismissing
          ? 'max-h-0 -translate-y-1 scale-y-95 opacity-0'
          : 'max-h-10 translate-y-0 scale-y-100 opacity-100',
        className,
      )}
    >
      <div className="relative flex items-center">
        <div className="h-px flex-1 bg-muted-foreground/18" />
        <span className="mx-3 inline-flex items-center rounded-full border border-muted-foreground/15 bg-muted/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/85">
          {label}
        </span>
        <div className="h-px flex-1 bg-muted-foreground/18" />
      </div>
    </div>
  );
});
