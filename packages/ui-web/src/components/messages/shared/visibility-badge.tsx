'use client';

import { memo } from 'react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import { EyeOff } from 'lucide-react';
import type { MessageVM } from '@iconicedu/shared-types';

interface VisibilityBadgeProps {
  message: MessageVM;
}

function getVisibilityText(visibility: MessageVM['core']['visibility']): string | null {
  if (visibility.type === 'all') return null;
  if (visibility.type === 'sender-only') return 'Only visible to you';
  if (visibility.type === 'recipient-only') return 'Only visible to recipient';
  if (visibility.type === 'specific-users') return 'Visible to specific users';
  return 'Private';
}

export const VisibilityBadge = memo(function VisibilityBadge({
  message,
}: VisibilityBadgeProps) {
  const text = getVisibilityText(message.core.visibility);
  if (!text) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={text}
            className="cursor-default"
            data-testid="message-visibility-badge"
          >
            <Badge variant="secondary" className="gap-1 px-1.5">
              <EyeOff className="h-2.5 w-2.5" aria-hidden="true" />
              <span className="text-[11px] font-medium leading-none">{text}</span>
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
