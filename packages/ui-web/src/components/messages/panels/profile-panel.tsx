'use client';

import type { MessagesRightPanelIntent } from '@iconicedu/shared-types';
import {
  ProfileContent,
  ProfileSheet,
} from '@iconicedu/ui-web/components/messages/profile-sheet';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';
import { resolveDashboardBasePathFromWindow } from '@iconicedu/ui-web/lib/dashboard-base-path';

interface ProfilePanelProps {
  intent: MessagesRightPanelIntent;
}

export function ProfilePanel({ intent }: ProfilePanelProps) {
  const isMobile = useIsMobile();
  const { channel } = useMessagesState();
  if (intent.key !== 'profile') return null;
  const user = channel.collections.participants.find(
    (participant) => participant.ids.id === intent.userId,
  );
  if (!user) return null;
  const handleDmClick =
    channel.basics.kind === 'dm'
      ? () => {
          if (typeof window !== 'undefined') {
            const dashboardBasePath = resolveDashboardBasePathFromWindow();
            window.location.href = `${dashboardBasePath}/dm/${channel.ids.id}`;
          }
        }
      : undefined;
  if (isMobile) {
    return <ProfileSheet user={user} onDmClick={handleDmClick} />;
  }
  return <ProfileContent user={user} onDmClick={handleDmClick} />;
}
