import type { ChannelVM, SidebarLeftDataVM } from '@iconicedu/shared-types';

function withMinimumUnread(channel: ChannelVM, minimumUnreadCount = 0): ChannelVM {
  if (minimumUnreadCount <= 0) {
    return channel;
  }

  const currentUnread = Math.max(0, channel.collections.readState?.unreadCount ?? 0);
  if (currentUnread >= minimumUnreadCount) {
    return channel;
  }

  return {
    ...channel,
    collections: {
      ...channel.collections,
      readState: {
        channelId: channel.collections.readState?.channelId ?? channel.ids.id,
        ...channel.collections.readState,
        unreadCount: minimumUnreadCount,
      },
    },
  };
}

export function upsertDirectMessageChannel(
  sidebarData: SidebarLeftDataVM,
  channel: ChannelVM,
  options?: { minimumUnreadCount?: number; moveToTop?: boolean },
): SidebarLeftDataVM {
  const moveToTop = options?.moveToTop ?? true;
  const nextChannel = withMinimumUnread(channel, options?.minimumUnreadCount ?? 0);
  const current = sidebarData.collections.directMessages;
  const existingIndex = current.findIndex((item) => item.ids.id === nextChannel.ids.id);

  if (existingIndex === -1) {
    const nextDirectMessages = moveToTop
      ? [nextChannel, ...current]
      : [...current, nextChannel];
    return {
      ...sidebarData,
      collections: {
        ...sidebarData.collections,
        directMessages: nextDirectMessages,
      },
    };
  }

  const existing = current[existingIndex];
  const existingUnread = Math.max(0, existing.collections.readState?.unreadCount ?? 0);
  const mergedUnread = Math.max(existingUnread, nextChannel.collections.readState?.unreadCount ?? 0);
  const merged = withMinimumUnread(nextChannel, mergedUnread);

  const withoutExisting = [...current.slice(0, existingIndex), ...current.slice(existingIndex + 1)];
  const nextDirectMessages = moveToTop
    ? [merged, ...withoutExisting]
    : [...withoutExisting.slice(0, existingIndex), merged, ...withoutExisting.slice(existingIndex)];

  return {
    ...sidebarData,
    collections: {
      ...sidebarData.collections,
      directMessages: nextDirectMessages,
    },
  };
}
