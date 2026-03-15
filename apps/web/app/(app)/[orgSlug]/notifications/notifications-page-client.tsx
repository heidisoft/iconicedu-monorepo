'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardHeader, InboxContainer } from '@iconicedu/ui-web';
import type { ActivityFeedVM } from '@iconicedu/shared-types';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';

const NOTIFICATIONS_REFRESH_DEBOUNCE_MS = 120;

type NotificationsPageClientProps = {
  orgId: string;
  orgSlug: string;
  profileId: string;
  feed: ActivityFeedVM;
  timezone?: string | null;
};

export function NotificationsPageClient({
  orgId,
  orgSlug,
  profileId,
  feed,
  timezone,
}: NotificationsPageClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  React.useEffect(() => {
    if (!orgId || !profileId) {
      return;
    }

    let refreshTimer: number | null = null;
    const notificationsPath = `/${orgSlug}/notifications`;

    const scheduleRefresh = () => {
      if (pathname !== notificationsPath) {
        return;
      }
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        React.startTransition(() => {
          router.refresh();
        });
      }, NOTIFICATIONS_REFRESH_DEBOUNCE_MS);
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
      <DashboardHeader title="Notifications" />
      <div className="p-4 pt-0">
        <InboxContainer feed={feed} timezone={timezone} />
      </div>
    </div>
  );
}
