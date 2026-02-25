'use client';

import type { UserProfileVM } from '@iconicedu/shared-types';
import { AvatarWithStatus } from '../../shared/avatar-with-status';
import { getProfileDisplayName } from '../../../lib/display-name';
import { resolveDashboardBasePathFromWindow } from '../../../lib/dashboard-base-path';
import { Button } from '../../../ui/button';
import { ScrollArea } from '../../../ui/scroll-area';
import { MessageCircle } from 'lucide-react';

interface MessagesMembersTabProps {
  participants: UserProfileVM[];
  currentUserId?: string | null;
  onProfileClick?: (userId: string) => void;
}

export function getMemberRowActionKind(
  memberId: string,
  currentUserId?: string | null,
): 'self' | 'message' | 'none' {
  if (!currentUserId) return 'none';
  if (memberId === currentUserId) return 'self';
  return 'message';
}

export function canOpenMemberProfile(
  onProfileClick?: ((userId: string) => void) | undefined,
): boolean {
  return typeof onProfileClick === 'function';
}

export function MessagesMembersTab({
  participants,
  currentUserId,
  onProfileClick,
}: MessagesMembersTabProps) {
  const dashboardBasePath = resolveDashboardBasePathFromWindow();
  const profileActionEnabled = canOpenMemberProfile(onProfileClick);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-2 p-3">
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : null}
        {participants.map((member) => {
          const memberName = getProfileDisplayName(member.profile);
          const actionKind = getMemberRowActionKind(member.ids.id, currentUserId);
          const dmTargetId = actionKind === 'message' ? member.ids.id : null;
          return (
            <div
              key={member.ids.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
            >
              <AvatarWithStatus
                name={memberName}
                avatar={member.profile.avatar}
                presence={member.presence}
                showStatus
                themeKey={member.ui?.themeKey}
                sizeClassName="h-9 w-9"
                initialsLength={1}
              />
              <div className="min-w-0 flex-1">
                {profileActionEnabled ? (
                  <button
                    type="button"
                    className="truncate text-left text-sm font-medium text-foreground hover:underline"
                    onClick={() => onProfileClick?.(member.ids.id)}
                  >
                    {memberName}
                  </button>
                ) : (
                  <div className="truncate text-sm font-medium text-foreground">{memberName}</div>
                )}
                {(member.presence?.state?.emoji || member.presence?.state?.text) && (
                  <div className="truncate text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {member.presence?.state?.emoji ? <span>{member.presence.state.emoji}</span> : null}
                      {member.presence?.state?.text ? (
                        <span className="truncate">{member.presence.state.text}</span>
                      ) : null}
                    </span>
                  </div>
                )}
              </div>
              {actionKind === 'self' ? (
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  You
                </span>
              ) : null}
              {dmTargetId ? (
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-primary/15 hover:text-primary"
                  aria-label={`Message ${memberName}`}
                >
                  <a href={`${dashboardBasePath}/dm/${dmTargetId}`}>
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
