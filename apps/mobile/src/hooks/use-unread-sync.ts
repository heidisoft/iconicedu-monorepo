import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/api/queries';

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
}) {
  const { orgId, profileId, accountId, profileKind } = params;
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

    const invalidateChannelLists = () => {
      const o = orgIdRef.current;
      const p = profileIdRef.current;
      const pk = profileKindRef.current;

      queryClient.invalidateQueries({
        queryKey: queryKeys.directMessages(o, p),
      });
      queryClient.invalidateQueries({
        queryKey: ['learningSpaceChannels', o, p, pk ?? null],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.supervisedDirectMessages(o, accountId),
      });
    };

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
        invalidateChannelLists,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channel_read_state',
          filter: `account_id=eq.${accountId}`,
        },
        invalidateChannelLists,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [accountId, orgId, profileId, queryClient]);
}
