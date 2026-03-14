import type { ISODateTime, SidebarLeftDataVM, UUID } from '@iconicedu/shared-types';

type SidebarWithClassRequestNav = Pick<SidebarLeftDataVM, 'navigation' | 'collections'>;

function getClassRequestUnreadCount(sidebarData: SidebarWithClassRequestNav) {
  return (sidebarData.collections.classRequestChannels ?? []).reduce(
    (total, channel) =>
      total + Math.max(0, channel.collections.readState?.unreadCount ?? 0),
    0,
  );
}

export function applyClassRequestUnreadCount<T extends SidebarWithClassRequestNav>(
  sidebarData: T,
  unreadCount: number,
): T {
  const normalizedUnreadCount = Math.max(0, unreadCount);

  return {
    ...sidebarData,
    navigation: {
      ...sidebarData.navigation,
      navMain: sidebarData.navigation.navMain.map((item) =>
        item.title === 'Class Requests'
          ? {
              ...item,
              count: normalizedUnreadCount || undefined,
            }
          : item,
      ),
    },
  } as T;
}

export function syncClassRequestUnreadCount<T extends SidebarWithClassRequestNav>(
  sidebarData: T,
) {
  return applyClassRequestUnreadCount(
    sidebarData,
    getClassRequestUnreadCount(sidebarData),
  );
}

export function markClassRequestChannelRead<T extends SidebarWithClassRequestNav>(
  sidebarData: T,
  channelId?: UUID | null,
  input?: { lastReadMessageId?: UUID | null; lastReadAt?: ISODateTime | null },
) {
  if (!channelId) {
    return sidebarData;
  }

  let changed = false;
  const nextChannels = (sidebarData.collections.classRequestChannels ?? []).map(
    (channel) => {
      const currentUnread = Math.max(0, channel.collections.readState?.unreadCount ?? 0);
      if (
        channel.ids.id !== channelId ||
        (currentUnread === 0 &&
          input?.lastReadMessageId === undefined &&
          input?.lastReadAt === undefined)
      ) {
        return channel;
      }

      changed = true;
      return {
        ...channel,
        collections: {
          ...channel.collections,
          readState: {
            ...channel.collections.readState,
            channelId: channel.collections.readState?.channelId ?? channel.ids.id,
            lastReadMessageId:
              input?.lastReadMessageId ??
              channel.collections.readState?.lastReadMessageId,
            lastReadAt: input?.lastReadAt ?? channel.collections.readState?.lastReadAt,
            unreadCount: 0,
          },
        },
      };
    },
  );

  if (!changed) {
    return sidebarData;
  }

  return syncClassRequestUnreadCount({
    ...sidebarData,
    collections: {
      ...sidebarData.collections,
      classRequestChannels: nextChannels,
    },
  });
}
