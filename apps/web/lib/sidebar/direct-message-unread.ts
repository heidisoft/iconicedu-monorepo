import type { SidebarLeftDataVM } from '@iconicedu/shared-types';

type IncomingMessageInput = {
  channelId: string;
  senderProfileId?: string | null;
  currentProfileId: string;
  activeChannelId?: string | null;
};

export function applyIncomingDirectMessageUnread(
  sidebarData: SidebarLeftDataVM,
  input: IncomingMessageInput,
): SidebarLeftDataVM {
  if (!input.channelId || input.senderProfileId === input.currentProfileId) {
    return sidebarData;
  }

  let changed = false;
  const nextDirectMessages = sidebarData.collections.directMessages.map((channel) => {
    if (channel.ids.id !== input.channelId) {
      return channel;
    }

    changed = true;
    const currentUnread = Math.max(0, channel.collections.readState?.unreadCount ?? 0);
    const nextUnread = input.activeChannelId === input.channelId ? 0 : currentUnread + 1;

    return {
      ...channel,
      collections: {
        ...channel.collections,
        readState: {
          ...channel.collections.readState,
          unreadCount: nextUnread,
        },
      },
    };
  });

  if (!changed) {
    return sidebarData;
  }

  return {
    ...sidebarData,
    collections: {
      ...sidebarData.collections,
      directMessages: nextDirectMessages,
    },
  };
}

export function markDirectMessageChannelRead(
  sidebarData: SidebarLeftDataVM,
  channelId?: string | null,
): SidebarLeftDataVM {
  if (!channelId) {
    return sidebarData;
  }

  let changed = false;
  const nextDirectMessages = sidebarData.collections.directMessages.map((channel) => {
    if (channel.ids.id !== channelId) {
      return channel;
    }
    const unreadCount = Math.max(0, channel.collections.readState?.unreadCount ?? 0);
    if (unreadCount === 0) {
      return channel;
    }

    changed = true;
    return {
      ...channel,
      collections: {
        ...channel.collections,
        readState: {
          ...channel.collections.readState,
          unreadCount: 0,
        },
      },
    };
  });

  if (!changed) {
    return sidebarData;
  }

  return {
    ...sidebarData,
    collections: {
      ...sidebarData.collections,
      directMessages: nextDirectMessages,
    },
  };
}
