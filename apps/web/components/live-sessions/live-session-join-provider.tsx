'use client';
import { useMemo, type ReactNode } from 'react';
import type { LiveSessionJoinLinkVM } from '@iconicedu/shared-types';
import { LiveSessionJoinContext } from '@iconicedu/ui-web/components/messages/live-session-join-context';
import { createApiClient } from '@iconicedu/web/lib/api/http-client';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
// flag-exempt: consistent passcode sharing for the existing core meeting join flow.
export function LiveSessionJoinProvider({
  orgId,
  profileId,
  children,
}: {
  orgId: string;
  profileId: string;
  children: ReactNode;
}) {
  const value = useMemo(() => {
    const api = createApiClient(createSupabaseBrowserClient());
    const body = { orgId, profileId };
    return {
      joinChannel: (channelId: string) =>
        api.post<LiveSessionJoinLinkVM>(
          `/channels/${encodeURIComponent(channelId)}/live-sessions/join`,
          body,
        ),
      resolveLink: async (href: string) => {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return null;
        const match = /^\/live\/([^/]+)$/.exec(url.pathname);
        if (!match) return null;
        return api.post<LiveSessionJoinLinkVM>(
          `/live-sessions/${encodeURIComponent(match[1])}/share-info`,
          body,
        );
      },
    };
  }, [orgId, profileId]);
  return (
    <LiveSessionJoinContext.Provider value={value}>
      {children}
    </LiveSessionJoinContext.Provider>
  );
}
