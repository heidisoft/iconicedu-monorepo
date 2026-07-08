'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardHeader, InboxContainer, toast } from '@iconicedu/ui-web';
import type { ActivityFeedItemVM, ActivityFeedVM } from '@iconicedu/shared-types';
import {
  approveSessionChangeRequestAction,
  listSessionChangeRequestsAction,
  rejectSessionChangeRequestAction,
} from '@iconicedu/web/app/actions/self-serve-class-session-change';
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
  const [pendingRequestIds, setPendingRequestIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [decisionInFlightRequestId, setDecisionInFlightRequestId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    let active = true;
    listSessionChangeRequestsAction({ orgSlug })
      .then((requests) => {
        if (!active) return;
        setPendingRequestIds(
          new Set(
            requests
              .filter((request) => request.status === 'pending')
              .map((request) => request.id),
          ),
        );
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Unable to load session change requests.',
        );
      });
    return () => {
      active = false;
    };
  }, [orgSlug]);

  const handleSessionChangeDecision = React.useCallback(
    async (activity: ActivityFeedItemVM, decision: 'approve' | 'reject') => {
      const requestId =
        typeof activity.metadata?.requestId === 'string'
          ? activity.metadata.requestId
          : null;
      if (!requestId) return;

      const note =
        decision === 'reject'
          ? window.prompt('Why are you denying this session change request?')
          : null;
      if (decision === 'reject' && !note?.trim()) {
        toast.error('Add a reason before denying the request.');
        return;
      }

      setDecisionInFlightRequestId(requestId);
      try {
        if (decision === 'approve') {
          await approveSessionChangeRequestAction({ orgSlug, requestId });
          toast.success('Session change approved.');
        } else {
          await rejectSessionChangeRequestAction({
            orgSlug,
            requestId,
            note: note?.trim() ?? null,
          });
          toast.success('Session change denied.');
        }
        setPendingRequestIds((current) => {
          const next = new Set(current);
          next.delete(requestId);
          return next;
        });
        React.startTransition(() => {
          router.refresh();
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Unable to update session change request.',
        );
      } finally {
        setDecisionInFlightRequestId(null);
      }
    },
    [orgSlug, router],
  );

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
        <InboxContainer
          feed={feed}
          timezone={timezone}
          showMarkAllAsRead
          currentProfileId={profileId}
          pendingSessionChangeRequestIds={pendingRequestIds}
          decisionInFlightRequestId={decisionInFlightRequestId}
          onSessionChangeDecision={handleSessionChangeDecision}
        />
      </div>
    </div>
  );
}
