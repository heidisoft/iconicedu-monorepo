'use client';

import { useCallback, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardHomeInfographicSection } from '@iconicedu/ui-web';
import type { DashboardUpcomingSessionListItem } from '@iconicedu/ui-web/components/dashboard/dashboard-home-infographic-section';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/use-external-live-session-join-dialog';

type HomePageInfographicClientProps = ComponentProps<
  typeof DashboardHomeInfographicSection
>;

export function HomePageInfographicClient(props: HomePageInfographicClientProps) {
  const router = useRouter();
  const { externalJoinTarget, closeExternalJoinDialog, handleResolvedJoinHref } =
    useExternalLiveSessionJoinDialog({
      onInternalJoinHref: (joinHref) => {
        router.push(joinHref);
      },
    });

  const handleJoinSession = useCallback(
    async (item: DashboardUpcomingSessionListItem) => {
      if (typeof window === 'undefined') {
        return;
      }

      if (!item.channelId) {
        handleResolvedJoinHref(item.joinHref);

        return;
      }

      const response = await window.fetch(
        `/api/channels/${item.channelId}/live-sessions/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orgSlug: props.orgSlug }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        joinPath?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.success || !payload.joinPath) {
        throw new Error(payload?.error ?? 'Failed to join live session');
      }

      handleResolvedJoinHref(payload.joinPath);
    },
    [handleResolvedJoinHref, props.orgSlug],
  );

  return (
    <>
      <DashboardHomeInfographicSection {...props} onJoinSession={handleJoinSession} />
      <ExternalLiveSessionJoinDialog
        target={externalJoinTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeExternalJoinDialog();
          }
        }}
      />
    </>
  );
}
