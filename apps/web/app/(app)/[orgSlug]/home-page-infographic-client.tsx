'use client';

import { useCallback, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardHomeInfographicSection } from '@iconicedu/ui-web';
import type { DashboardUpcomingSessionListItem } from '@iconicedu/ui-web/components/dashboard/dashboard-home-infographic-section';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/use-external-live-session-join-dialog';
import { requestLiveSessionJoin } from '@iconicedu/web/lib/live-sessions/join-client';

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

      const occurrence =
        props.anyVisibleJoinEnabled && item.scheduleId && item.occurrenceKey
          ? { scheduleId: item.scheduleId, occurrenceKey: item.occurrenceKey }
          : null;

      if (!occurrence && !item.channelId) {
        handleResolvedJoinHref(item.joinHref);

        return;
      }

      const joinPath = await requestLiveSessionJoin({
        orgSlug: props.orgSlug,
        channelId: item.channelId,
        occurrence,
      });

      handleResolvedJoinHref(joinPath);
    },
    [handleResolvedJoinHref, props.anyVisibleJoinEnabled, props.orgSlug],
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
