'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardHeader, InboxContainer } from '@iconicedu/ui-web';
import type { ActivityFeedVM } from '@iconicedu/shared-types';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';

const INBOX_REFRESH_DEBOUNCE_MS = 120;

type InboxPageClientProps = {
  orgId: string;
  orgSlug: string;
  profileId: string;
  feed: ActivityFeedVM;
};

export function InboxPageClient({
  orgId,
  orgSlug,
  profileId,
  feed,
}: InboxPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  React.useEffect(() => {
    if (!orgId || !profileId) {
      return;
    }

    let refreshTimer: number | null = null;
    const inboxPath = `/${orgSlug}/inbox`;

    const scheduleRefresh = () => {
      if (pathname !== inboxPath) {
        return;
      }
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        React.startTransition(() => {
          router.refresh();
        });
      }, INBOX_REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase.channel(`inbox:${orgId}:${profileId}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'activity_feed_items',
        filter: `recipient_profile_id=eq.${profileId}`,
      },
      scheduleRefresh,
    );
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'activity_feed_group_members',
        filter: `org_id=eq.${orgId}`,
      },
      scheduleRefresh,
    );
    channel.subscribe();

    const onFocus = () => {
      scheduleRefresh();
    };
    const onVisibilityChange = () => {
      if (!document.hidden) {
        scheduleRefresh();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      void channel.unsubscribe();
    };
  }, [orgId, orgSlug, pathname, profileId, router, supabase]);

  return (
    <div className="flex min-h-0 h-screen flex-1 flex-col">
      <DashboardHeader title="Inbox" />
      <div className="p-4 pt-0">
        <InboxContainer feed={feed} />
      </div>
    </div>
  );
}
