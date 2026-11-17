'use client';

import { memo } from 'react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import { LockKeyhole } from 'lucide-react';
import type { MessageVM } from '@iconicedu/shared-types';
import { useOptionalMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

interface VisibilityBadgeProps {
  message: MessageVM;
}

function getVisibilityText(
  visibility: MessageVM['core']['visibility'],
  participantNames: Map<string, string>,
): string | null {
  if (visibility.type === 'all') return null;
  if (visibility.type === 'sender-only') return 'Only visible to you';
  if (visibility.type === 'recipient-only') return 'Only visible to recipient';
  if (visibility.type === 'specific-users') {
    const names = visibility.userIds
      .map((id) => participantNames.get(id))
      .filter((name): name is string => Boolean(name));
    if (!names.length) return 'Only visible to selected people';
    return `Only visible to ${names.join(', ')}`;
  }
  return 'Private';
}

export const VisibilityBadge = memo(function VisibilityBadge({
  message,
}: VisibilityBadgeProps) {
  const state = useOptionalMessagesState();
  const participantNames = new Map(
    (state?.channel.collections.participants ?? []).map((participant) => [
      participant.ids.id,
      participant.profile.displayName,
    ]),
  );
  const text = getVisibilityText(message.core.visibility, participantNames);
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
              <LockKeyhole className="h-2.5 w-2.5" aria-hidden="true" />
              <span className="text-[11px] font-medium leading-none">{text}</span>
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
