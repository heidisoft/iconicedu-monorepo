import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queries';
import type { ChannelListItem } from '@/lib/api/types';

type ChannelReadState = {
  channelId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  unreadCount: number;
} | null;

function updateChannelListUnreadCount(
  items: ChannelListItem[] | undefined,
  channelId: string,
): ChannelListItem[] | undefined {
  if (!Array.isArray(items) || items.length === 0) return items;

  let didChange = false;
  const nextItems = items.map((item) => {
    if (item.id !== channelId || (item.unread_count ?? 0) === 0) {
      return item;
    }
    didChange = true;
    return {
      ...item,
      unread_count: 0,
    };
  });

  return didChange ? nextItems : items;
}

export function applyOptimisticChannelReadState(input: {
  queryClient: QueryClient;
  orgId: string;
  profileId: string;
  accountId: string;
  channelId: string;
  lastReadMessageId: string;
  profileKind?: string | null;
}) {
  const {
    queryClient,
    orgId,
    profileId,
    accountId,
    channelId,
    lastReadMessageId,
    profileKind,
  } = input;

  const lastReadAt = new Date().toISOString();

  queryClient.setQueryData<ChannelReadState>(
    queryKeys.channelReadState(channelId, accountId),
    (current) => ({
      channelId,
      lastReadMessageId,
      lastReadAt,
      unreadCount: 0,
      ...(current ?? {}),
    }),
  );

  queryClient.setQueryData<ChannelListItem[]>(
    queryKeys.directMessages(orgId, profileId),
    (current) => updateChannelListUnreadCount(current, channelId),
  );

  queryClient.setQueryData<ChannelListItem[]>(
    ['learningSpaceChannels', orgId, profileId, profileKind ?? null],
    (current) => updateChannelListUnreadCount(current, channelId),
  );

  queryClient.setQueryData<ChannelListItem[]>(
    queryKeys.supervisedDirectMessages(orgId, accountId),
    (current) => updateChannelListUnreadCount(current, channelId),
  );
}
