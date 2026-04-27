import { useRef, useCallback } from 'react';
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
};

export function useMarkRead({
  orgId,
  profileId,
  accountId,
  channelId,
  profileKind,
}: UseMarkReadParams) {
  const queryClient = useQueryClient();
  const lastMarkedChannelIdRef = useRef<string | null>(null);

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

  return { markChannelRead, markThreadRead };
}
