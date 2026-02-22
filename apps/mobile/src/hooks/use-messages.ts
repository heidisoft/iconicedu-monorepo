import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { queryKeys, fetchChannelMessages } from '@/lib/api/queries';
import { supabase } from '@/lib/supabase/client';

export function useMessages(channelId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.messages(channelId),
    queryFn: () => fetchChannelMessages(channelId),
    enabled: !!channelId,
  });

  // Subscribe to realtime message inserts
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
          queryClient.invalidateQueries({
            queryKey: queryKeys.messages(channelId),
          });
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
          queryClient.invalidateQueries({
            queryKey: queryKeys.messages(channelId),
          });
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
      40,
      oldest.core.createdAt,
    );

    queryClient.setQueryData(
      queryKeys.messages(channelId),
      (prev: typeof query.data) => [...olderMessages, ...(prev ?? [])],
    );
  }, [channelId, query.data, queryClient]);

  return { ...query, loadMore };
}
