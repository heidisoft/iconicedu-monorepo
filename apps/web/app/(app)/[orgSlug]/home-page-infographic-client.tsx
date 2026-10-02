'use client';

import { useCallback, useMemo, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardHomeInfographicSection } from '@iconicedu/ui-web';
import type { DashboardUpcomingSessionListItem } from '@iconicedu/ui-web/components/dashboard/dashboard-home-infographic-section';
import { ExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/external-live-session-join-dialog';
import { useExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/use-external-live-session-join-dialog';

import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';

type HomePageInfographicClientProps = ComponentProps<
  typeof DashboardHomeInfographicSection
> & {
  orgId: string;
  currentUserId?: string;
};

export function HomePageInfographicClient({
  orgId,
  currentUserId,
  ...props
}: HomePageInfographicClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { externalJoinTarget, closeExternalJoinDialog, handleResolvedJoinHref } =
    useExternalLiveSessionJoinDialog({
      onInternalJoinHref: (joinHref) => {
        router.push(joinHref);
      },
    });

  const handleJoinSession = useCallback(
    async (item: DashboardUpcomingSessionListItem) => {
      if (!item.channelId) {
        handleResolvedJoinHref(item.joinHref);

        return;
      }

      if (!currentUserId) {
        throw new Error('Current user is required');
      }

      const payload = await createApiClient(supabase).post<{
        joinPath: string;
        provider?: string;
      }>(`/channels/${item.channelId}/live-sessions/join`, {
        orgId,
        profileId: currentUserId,
      });

      handleResolvedJoinHref(payload.joinPath, payload.provider);
    },
    [currentUserId, handleResolvedJoinHref, orgId, supabase],
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
