import { useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { markChannelReadState, markThreadReadState, queryKeys } from '@/lib/api/queries';
import {
  applyOptimisticChannelReadState,
  applyOptimisticThreadReadState,
} from '@/lib/messages/apply-optimistic-channel-read-state';
import { reportMobileObservedError } from '@/lib/analytics/report-error';

type UseMarkReadParams = {
  orgId: string;
  profileId: string;
  accountId: string;
  channelId: string;
  profileKind?: string | null;
  /** Screen focus state — pass to auto-clear a manual unread mark on refocus. */
  isFocused?: boolean;
  isManuallyUnread?: boolean;
  lastReadMessageId?: string | null;
};

export function useMarkRead({
  orgId,
  profileId,
  accountId,
  channelId,
  profileKind,
  isFocused,
  isManuallyUnread,
  lastReadMessageId,
}: UseMarkReadParams) {
  const queryClient = useQueryClient();
  const lastMarkedChannelIdRef = useRef<string | null>(null);

  // Marking a channel unread doesn't change the latest message id, so without
  // this the "already marked read for this message id" guard below would
  // silently swallow the next genuine read (e.g. leaving and reopening the
  // channel) and the manual-unread flag would never clear server-side.
  const resetChannelReadGuard = useCallback(() => {
    lastMarkedChannelIdRef.current = null;
  }, []);

  const markChannelRead = useCallback(
    async (lastReadMessageId: string) => {
      if (!channelId || !orgId || !accountId || !profileId || !lastReadMessageId) return;
      if (lastMarkedChannelIdRef.current === lastReadMessageId) return;

      lastMarkedChannelIdRef.current = lastReadMessageId;
      applyOptimisticChannelReadState({
        queryClient,
        orgId,
        profileId,
        accountId,
        channelId,
        lastReadMessageId,
        profileKind,
      });

      try {
        const unreadCount = await markChannelReadState({
          orgId,
          accountId,
          profileId,
          channelId,
          lastReadMessageId,
        });
        queryClient.setQueryData(queryKeys.channelReadState(channelId, accountId), {
          channelId,
          lastReadMessageId,
          lastReadAt: new Date().toISOString(),
          unreadCount,
        });
      } catch {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.channelReadState(channelId, accountId),
        });
      }
    },
    [orgId, profileId, accountId, channelId, profileKind, queryClient],
  );

  // A channel manually marked unread has no genuinely new incoming message
  // for the "unread viewed" scroll heuristic to notice, so that trigger
  // never fires and the manual flag would otherwise stay set forever.
  //
  // Reopening the channel from the conversation list pushes a brand-new
  // screen instance each time (pop/push, not a persisted mount), so a
  // "blur-then-refocus on this instance" check never actually fires on a
  // normal reopen — the very first render is already focused. So instead we
  // track the last *observed* value of isManuallyUnread: if it's true and
  // the previous observed value was NOT a live "false → true" flip while
  // already focused (i.e. it was already true when we first saw a real
  // value, however that happened), it predates this screen and we clear it.
  // If it flips false → true while we're already focused, that's the user's
  // own mark-unread action on this same live screen — leave it alone.
  const previousManuallyUnreadRef = useRef<boolean | undefined>(undefined);
  const wasFocusedRef = useRef(isFocused ?? false);
  useEffect(() => {
    const previousManuallyUnread = previousManuallyUnreadRef.current;
    const wasFocused = wasFocusedRef.current;
    previousManuallyUnreadRef.current = isManuallyUnread;
    wasFocusedRef.current = isFocused ?? false;

    if (!isFocused || !isManuallyUnread || !lastReadMessageId) return;

    const justMarkedUnreadOnThisLiveScreen =
      previousManuallyUnread === false && wasFocused === true;
    if (!justMarkedUnreadOnThisLiveScreen) {
      void markChannelRead(lastReadMessageId);
    }
  }, [isFocused, isManuallyUnread, lastReadMessageId, markChannelRead]);

  const markThreadRead = useCallback(
    async (input: {
      orgId: string;
      channelId: string;
      parentMessageId: string;
      threadId: string;
      lastReadMessageId?: string | null;
    }) => {
      applyOptimisticThreadReadState({
        queryClient,
        orgId: input.orgId,
        channelId: input.channelId,
        profileId,
        accountId,
        parentMessageId: input.parentMessageId,
        lastReadMessageId: input.lastReadMessageId,
      });

      try {
        await markThreadReadState({
          orgId: input.orgId,
          accountId,
          profileId,
          channelId: input.channelId,
          threadId: input.threadId,
          lastReadMessageId: input.lastReadMessageId,
        });
      } catch (error) {
        reportMobileObservedError({
          error,
          source: 'mobile.messages.use_mark_read.thread_read_state_sync',
          message: 'Failed to sync thread read state',
          context: {
            channelId: input.channelId,
            threadId: input.threadId,
            parentMessageId: input.parentMessageId,
          },
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.messages(input.channelId, profileId),
          exact: true,
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.directMessages(input.orgId, profileId),
          exact: true,
        });
        void queryClient.invalidateQueries({
          queryKey: ['learningSpaceChannels', input.orgId, profileId],
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.supervisedDirectMessages(input.orgId, accountId),
          exact: true,
        });
      }
    },
    [accountId, profileId, queryClient],
  );

  return { markChannelRead, markThreadRead, resetChannelReadGuard };
}
