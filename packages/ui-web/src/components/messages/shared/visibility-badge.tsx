'use client';

import { memo } from 'react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web/ui/popover';
import { LockKeyhole } from 'lucide-react';
import type { MessageVM } from '@iconicedu/shared-types';
import { useOptionalMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

interface VisibilityBadgeProps {
  message: MessageVM;
}

export function getVisibilityCopy(
  visibility: MessageVM['core']['visibility'],
  participantNames: Map<string, string>,
  currentUserId?: string,
): { summary: string; names: string[] } | null {
  if (visibility.type === 'all') return null;
  if (visibility.type === 'sender-only') {
    return { summary: 'Only visible to you', names: ['You'] };
  }
  if (visibility.type === 'recipient-only') {
    const name =
      visibility.userId === currentUserId
        ? 'You'
        : (participantNames.get(visibility.userId) ?? 'Recipient');
    return {
      summary: `Only visible to ${name === 'You' ? 'you' : name}`,
      names: [name],
    };
  }
  if (visibility.type === 'specific-users') {
    const userIds = [...new Set(visibility.userIds)];
    const names = userIds.map((id) =>
      id === currentUserId ? 'You' : (participantNames.get(id) ?? 'Channel member'),
    );
    const includesCurrentUser = Boolean(currentUserId && userIds.includes(currentUserId));
    if (includesCurrentUser) {
      const otherCount = Math.max(0, userIds.length - 1);
      return {
        summary:
          otherCount === 0
            ? 'Only visible to you'
            : `Only visible to you + ${otherCount} ${otherCount === 1 ? 'other' : 'others'}`,
        names,
      };
    }
    const remainingCount = Math.max(0, names.length - 1);
    return {
      summary:
        remainingCount === 0
          ? `Only visible to ${names[0] ?? 'selected person'}`
          : `Only visible to ${names[0] ?? 'selected person'} + ${remainingCount} ${remainingCount === 1 ? 'other' : 'others'}`,
      names,
    };
  }
  return { summary: 'Private', names: [] };
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
  const copy = getVisibilityCopy(
    message.core.visibility,
    participantNames,
    state?.currentUserId,
  );
  if (!copy) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${copy.summary}. Show audience`}
          className="cursor-default"
          data-testid="message-visibility-badge"
        >
          <Badge variant="secondary" className="gap-1 px-1.5">
            <LockKeyhole className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none">{copy.summary}</span>
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-40 max-w-64 p-3">
        <p className="mb-1 text-xs font-semibold">Visible to</p>
        <ul className="space-y-0.5 text-xs">
          {copy.names.map((name, index) => (
            <li key={`${name}:${index}`}>{name}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
});
