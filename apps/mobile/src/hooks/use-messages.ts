import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { queryKeys, fetchChannelMessages, toggleReaction as apiToggleReaction } from '@/lib/api/queries';
import { supabase } from '@/lib/supabase/client';
import type { MessageVM, ReactionVM } from '@iconicedu/shared-types';

export function useMessages(channelId: string, currentProfileId = '', currentAccountId = '') {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.messages(channelId),
    queryFn: () => fetchChannelMessages(channelId, currentProfileId, currentAccountId),
    enabled: !!channelId,
  });

  // Subscribe to realtime message changes
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_text',
        },
        () => {
          // Text payload inserted — refetch so the message body is available
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          // Reaction change: invalidate so reactions re-fetch with next poll
          queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  const loadMore = useCallback(async () => {
    if (!query.data?.length) return;
    const oldest = query.data[0];
    if (!oldest) return;

    const olderMessages = await fetchChannelMessages(
      channelId,
      currentProfileId,
      currentAccountId,
      40,
      oldest.core.createdAt,
    );

    queryClient.setQueryData(
      queryKeys.messages(channelId),
      (prev: typeof query.data) => [...olderMessages, ...(prev ?? [])],
    );
  }, [channelId, currentProfileId, currentAccountId, query.data, queryClient]);

  /**
   * Optimistically toggles a reaction in the cache, then calls the API.
   * Falls back to invalidate on error so the UI stays correct.
   */
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const key = queryKeys.messages(channelId);

      // Snapshot for rollback
      const previous = queryClient.getQueryData<MessageVM[]>(key);

      // Optimistic update
      queryClient.setQueryData<MessageVM[]>(key, (msgs) => {
        if (!msgs) return msgs;
        return msgs.map((msg) => {
          if (msg.ids.id !== messageId) return msg;

          const reactions: ReactionVM[] = msg.social?.reactions ?? [];
          const existing = reactions.find((r) => r.emoji === emoji);

          let nextReactions: ReactionVM[];
          if (existing) {
            // Toggle off
            nextReactions = existing.count <= 1
              ? reactions.filter((r) => r.emoji !== emoji)
              : reactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: r.count - 1, reactedByMe: false }
                    : r,
                );
          } else {
            // Toggle on
            nextReactions = [
              ...reactions,
              { emoji, count: 1, reactedByMe: true, sampleUserIds: [currentAccountId] },
            ];
          }

          return { ...msg, social: { ...msg.social, reactions: nextReactions } };
        });
      });

      try {
        // message_reactions uses account_id
        await apiToggleReaction(messageId, currentAccountId, emoji);
      } catch {
        // Roll back on error
        queryClient.setQueryData(key, previous);
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [channelId, currentAccountId, queryClient],
  );

  return { ...query, loadMore, toggleReaction };
}
