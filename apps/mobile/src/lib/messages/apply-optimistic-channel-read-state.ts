import type { QueryClient } from '@tanstack/react-query';
import type { MessageVM } from '@iconicedu/shared-types';
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

function updateChannelListThreadUnreadCount(
  items: ChannelListItem[] | undefined,
  channelId: string,
  clearedUnreadCount: number,
): ChannelListItem[] | undefined {
  if (!Array.isArray(items) || items.length === 0 || clearedUnreadCount <= 0) {
    return items;
  }

  let didChange = false;
  const nextItems = items.map((item) => {
    if (item.id !== channelId) {
      return item;
    }

    const currentThreadUnreadCount = item.thread_unread_count ?? 0;
    const nextThreadUnreadCount = Math.max(
      0,
      currentThreadUnreadCount - clearedUnreadCount,
    );
    if (nextThreadUnreadCount === currentThreadUnreadCount) {
      return item;
    }

    didChange = true;
    return {
      ...item,
      thread_unread_count: nextThreadUnreadCount,
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
      ...(current ?? {}),
      channelId,
      lastReadMessageId,
      lastReadAt,
      unreadCount: 0,
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

export function applyOptimisticThreadReadState(input: {
  queryClient: QueryClient;
  orgId: string;
  channelId: string;
  profileId: string;
  accountId: string;
  parentMessageId: string;
  lastReadMessageId?: string | null;
}): void {
  const {
    queryClient,
    orgId,
    channelId,
    profileId,
    accountId,
    parentMessageId,
    lastReadMessageId,
  } = input;
  const lastReadAt = new Date().toISOString();
  let clearedUnreadCount = 0;

  queryClient.setQueryData<MessageVM[]>(
    queryKeys.messages(channelId, profileId),
    (current) => {
      if (!Array.isArray(current) || current.length === 0) {
        return current;
      }

      let didChange = false;
      const nextMessages = current.map((message) => {
        if (message.ids.id !== parentMessageId) {
          return message;
        }

        const thread = message.social?.thread;
        const unreadCount = thread?.readState?.unreadCount ?? 0;
        if (!thread) {
          return message;
        }

        if (unreadCount > 0) {
          clearedUnreadCount = unreadCount;
        }
        didChange = true;
        return {
          ...message,
          social: {
            ...message.social,
            thread: {
              ...thread,
              readState: {
                ...thread.readState,
                threadId: thread.ids.id,
                channelId: thread.readState?.channelId ?? channelId,
                lastReadMessageId:
                  lastReadMessageId ?? thread.readState?.lastReadMessageId,
                lastReadAt,
                unreadCount: 0,
              },
            },
          },
        } as MessageVM;
      });

      return didChange ? nextMessages : current;
    },
  );

  if (clearedUnreadCount <= 0) {
    return;
  }

  queryClient.setQueryData<ChannelListItem[]>(
    queryKeys.directMessages(orgId, profileId),
    (current) =>
      updateChannelListThreadUnreadCount(current, channelId, clearedUnreadCount),
  );

  queryClient.setQueriesData<ChannelListItem[]>(
    {
      queryKey: ['learningSpaceChannels', orgId, profileId],
    },
    (current) =>
      updateChannelListThreadUnreadCount(current, channelId, clearedUnreadCount),
  );

  queryClient.setQueryData<ChannelListItem[]>(
    queryKeys.supervisedDirectMessages(orgId, accountId),
    (current) =>
      updateChannelListThreadUnreadCount(current, channelId, clearedUnreadCount),
  );
}
