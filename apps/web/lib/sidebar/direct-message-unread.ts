import type { ISODateTime, SidebarLeftDataVM, UUID } from '@iconicedu/shared-types';

type IncomingMessageInput = {
  channelId: UUID;
  senderProfileId?: UUID | null;
  currentProfileId: UUID;
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
    const nextUnread = currentUnread + 1;

    return {
      ...channel,
      collections: {
        ...channel.collections,
        readState: {
          ...channel.collections.readState,
          channelId: channel.ids.id,
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

export function touchDirectMessageChannelOrder(
  sidebarData: SidebarLeftDataVM,
  channelId?: UUID | null,
): SidebarLeftDataVM {
  if (!channelId) {
    return sidebarData;
  }

  const current = sidebarData.collections.directMessages;
  const index = current.findIndex((channel) => channel.ids.id === channelId);
  if (index <= 0) {
    return sidebarData;
  }

  const [target] = current.slice(index, index + 1);
  const nextDirectMessages = [target, ...current.slice(0, index), ...current.slice(index + 1)];

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
  channelId?: UUID | null,
  input?: { lastReadMessageId?: UUID | null; lastReadAt?: ISODateTime | null },
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
          channelId: channel.ids.id,
          lastReadMessageId:
            input?.lastReadMessageId ??
            channel.collections.readState?.lastReadMessageId,
          lastReadAt: input?.lastReadAt ?? channel.collections.readState?.lastReadAt,
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
