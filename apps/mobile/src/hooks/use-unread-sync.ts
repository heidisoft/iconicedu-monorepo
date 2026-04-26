import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/api/queries';
import type { ChannelListItem } from '@/lib/api/types';

const BADGE_SYNC_DEBOUNCE_MS = 400;
let badgeSyncTimerId: ReturnType<typeof setTimeout> | null = null;

type ReadStateRealtimePayload = {
  new?: { thread_id?: string | null; channel_id?: string | null } | null;
  old?: { thread_id?: string | null; channel_id?: string | null } | null;
};

function isChannelLevelReadStatePayload(payload: ReadStateRealtimePayload) {
  const threadId = payload.new?.thread_id ?? payload.old?.thread_id ?? null;
  return threadId == null;
}

export function resolveChannelIdFromPayload(payload: ReadStateRealtimePayload) {
  const channelId = payload.new?.channel_id ?? payload.old?.channel_id ?? null;
  return typeof channelId === 'string' && channelId.length > 0 ? channelId : null;
}

function getNotificationsModule() {
  // Function-scoped require avoids loading the native module in Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  return require('expo-notifications') as typeof import('expo-notifications');
}

async function syncUnreadBadgeCount(orgId: string, accountId: string) {
  try {
    const Notifications = getNotificationsModule();
    const { data, error } = await supabase
      .from('channel_read_state')
      .select('unread_count')
      .eq('org_id', orgId)
      .eq('account_id', accountId)
      .is('deleted_at', null);

    if (error || !Array.isArray(data)) {
      return;
    }

    const unreadCount = data.reduce(
      (total, row) =>
        total + (typeof row?.unread_count === 'number' ? row.unread_count : 0),
      0,
    );

    await Notifications.setBadgeCountAsync(unreadCount);
  } catch {
    // Ignore badge sync failures.
  }
}

function scheduleUnreadBadgeCountSync(orgId: string, accountId: string) {
  if (badgeSyncTimerId) {
    clearTimeout(badgeSyncTimerId);
  }

  badgeSyncTimerId = setTimeout(() => {
    badgeSyncTimerId = null;
    void syncUnreadBadgeCount(orgId, accountId);
  }, BADGE_SYNC_DEBOUNCE_MS);
}

/**
 * Subscribes to realtime changes on `channel_read_state` for the current
 * account and invalidates the channel-list queries so that the Messages tab
 * badge and the message list unread counts update immediately when a new
 * message arrives (without requiring the user to leave and re-enter the screen).
 *
 * Mount this once at the tab-layout level so it runs for the whole session.
 */
export function useUnreadSync(params: {
  orgId: string;
  profileId: string;
  accountId: string;
  profileKind?: string | null;
  guardianAccountId?: string;
}) {
  const { orgId, profileId, accountId, profileKind, guardianAccountId } = params;
  const queryClient = useQueryClient();

  // Keep stable refs so the effect closure always has current values without
  // needing to be re-run every time a prop changes.
  const orgIdRef = useRef(orgId);
  const profileIdRef = useRef(profileId);
  const profileKindRef = useRef(profileKind);

  useEffect(() => {
    orgIdRef.current = orgId;
  }, [orgId]);
  useEffect(() => {
    profileIdRef.current = profileId;
  }, [profileId]);
  useEffect(() => {
    profileKindRef.current = profileKind;
  }, [profileKind]);

  useEffect(() => {
    if (!accountId || !orgId || !profileId) return;

    const invalidateChannelLists = (
      o: string,
      p: string,
      pk: string | null | undefined,
      channelId: string | null,
    ) => {
      const dmKey = queryKeys.directMessages(o, p);
      const spaceKey = ['learningSpaceChannels', o, p, pk ?? null] as const;
      const supervisedKey = queryKeys.supervisedDirectMessages(
        o,
        guardianAccountId ?? accountId,
      );

      if (!channelId) {
        // No channel context — invalidate all three lists.
        queryClient.invalidateQueries({ queryKey: dmKey });
        queryClient.invalidateQueries({ queryKey: spaceKey });
        queryClient.invalidateQueries({ queryKey: supervisedKey });
        return;
      }

      // Only invalidate the list(s) that contain this channel.
      // Fall back to invalidating if the list is not yet cached.
      const dmCache = queryClient.getQueryData<ChannelListItem[]>(dmKey);
      if (!dmCache || dmCache.some((item) => item.id === channelId)) {
        queryClient.invalidateQueries({ queryKey: dmKey });
      }

      const spaceCache = queryClient.getQueryData<ChannelListItem[]>(spaceKey);
      if (!spaceCache || spaceCache.some((item) => item.id === channelId)) {
        queryClient.invalidateQueries({ queryKey: spaceKey });
      }

      const supervisedCache = queryClient.getQueryData<ChannelListItem[]>(supervisedKey);
      if (!supervisedCache || supervisedCache.some((item) => item.id === channelId)) {
        queryClient.invalidateQueries({ queryKey: supervisedKey });
      }
    };

    const handleReadStateChange = (payload?: ReadStateRealtimePayload) => {
      const o = orgIdRef.current;
      const p = profileIdRef.current;
      const pk = profileKindRef.current;
      const channelId = payload ? resolveChannelIdFromPayload(payload) : null;

      if (payload && !isChannelLevelReadStatePayload(payload)) {
        if (channelId && p) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.messages(channelId, p),
            exact: true,
          });
        }
      }

      invalidateChannelLists(o, p, pk, channelId);
      scheduleUnreadBadgeCountSync(o, accountId);
    };

    void syncUnreadBadgeCount(orgId, accountId);

    const ch = supabase
      .channel(`unread-sync:${accountId}`)
      // Fire whenever a row in channel_read_state is created or updated for
      // this account — this happens when the backend increments unread_count
      // after a new message is delivered.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_read_state',
          filter: `account_id=eq.${accountId}`,
        },
        handleReadStateChange,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channel_read_state',
          filter: `account_id=eq.${accountId}`,
        },
        handleReadStateChange,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [accountId, orgId, profileId, queryClient]);
}
