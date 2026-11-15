'use client';

import type { ReactNode } from 'react';
import { IdCardLanyard } from 'lucide-react';

import { cn } from '@iconicedu/ui-web/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';

type RoleNameIndicatorProps = {
  name: ReactNode;
  role?: string | null;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
};

function isStaffRole(role?: string | null) {
  return role === 'staff';
}

const STAFF_LABEL = 'STAFF';

export function RoleNameIndicator({
  name,
  role,
  className,
  textClassName,
  iconClassName,
}: RoleNameIndicatorProps) {
  const showStaffIcon = isStaffRole(role);

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <span className={cn('min-w-0 truncate', textClassName)}>{name}</span>
      {showStaffIcon ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              aria-label={STAFF_LABEL}
            >
              <IdCardLanyard
                className={cn('h-3.5 w-3.5 shrink-0', iconClassName)}
                data-testid="staff-name-indicator"
                aria-hidden="true"
              />
              <span aria-hidden="true">Staff</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{STAFF_LABEL}</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
