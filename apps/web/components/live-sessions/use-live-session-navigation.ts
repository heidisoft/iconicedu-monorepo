'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useExternalLiveSessionJoinDialog } from '@iconicedu/ui-web/components/messages/use-external-live-session-join-dialog';
import { withLiveSessionReturnPath } from '@iconicedu/web/lib/live-sessions/navigation';

/** Show the existing ready-to-join dialog for app-hosted Zoom sessions.
 * The Open action retains the join source; Copy link omits that personal source.
 * Other internal routes and external providers retain their existing behavior.
 */
export function useLiveSessionNavigation() {
  const router = useRouter();
  const dialog = useExternalLiveSessionJoinDialog({
    onInternalJoinHref: (href) => router.push(href),
  });
  const resolveJoin = dialog.handleResolvedJoinHref;
  const openDialog = dialog.openExternalJoinDialog;
  const handleResolvedJoinHref = useCallback(
    (href: string, provider?: string | null) => {
      const prepared = withLiveSessionReturnPath(href, window.location);
      const url = new URL(prepared, window.location.href);
      if (url.origin === window.location.origin && /^\/live\/[^/]+$/.test(url.pathname)) {
        const copyUrl = new URL(url);
        copyUrl.searchParams.delete('returnTo');
        openDialog(url.toString(), provider ?? 'zoom', {
          isInternal: true,
          copyHref: copyUrl.toString(),
        });
        return;
      }
      resolveJoin(prepared, provider);
    },
    [resolveJoin, openDialog],
  );
  return { ...dialog, handleResolvedJoinHref };
}
