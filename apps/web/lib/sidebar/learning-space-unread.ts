import type { ISODateTime, SidebarLeftDataVM, UUID } from '@iconicedu/shared-types';

type IncomingMessageInput = {
  channelId: UUID;
  senderProfileId?: UUID | null;
  currentProfileId: UUID;
};

export function applyIncomingLearningSpaceUnread(
  sidebarData: SidebarLeftDataVM,
  input: IncomingMessageInput,
): SidebarLeftDataVM {
  if (!input.channelId || input.senderProfileId === input.currentProfileId) {
    return sidebarData;
  }

  let changed = false;
  const nextLearningSpaces = sidebarData.collections.learningSpaces.map((space) => {
    const primaryChannel = space.channels.primaryChannel;
    const relatedChannels = space.channels.relatedChannels ?? [];

    const nextPrimaryChannel =
      primaryChannel.ids.id === input.channelId
        ? buildUnreadIncrementedChannel(primaryChannel)
        : primaryChannel;
    const nextRelatedChannels = relatedChannels.map((channel) =>
      channel.ids.id === input.channelId
        ? buildUnreadIncrementedChannel(channel)
        : channel,
    );

    const matched =
      nextPrimaryChannel !== primaryChannel ||
      nextRelatedChannels.some((channel, index) => channel !== relatedChannels[index]);

    if (!matched) {
      return space;
    }

    changed = true;

    return {
      ...space,
      channels: {
        ...space.channels,
        primaryChannel: nextPrimaryChannel,
        relatedChannels: nextRelatedChannels,
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
      learningSpaces: nextLearningSpaces,
    },
  };
}

export function markLearningSpaceChannelRead(
  sidebarData: SidebarLeftDataVM,
  channelId?: UUID | null,
  input?: { lastReadMessageId?: UUID | null; lastReadAt?: ISODateTime | null },
): SidebarLeftDataVM {
  if (!channelId) {
    return sidebarData;
  }

  let changed = false;
  const nextLearningSpaces = sidebarData.collections.learningSpaces.map((space) => {
    const primaryChannel = space.channels.primaryChannel;
    const relatedChannels = space.channels.relatedChannels ?? [];

    const nextPrimaryChannel =
      primaryChannel.ids.id === channelId
        ? buildUnreadClearedChannel(primaryChannel, input)
        : primaryChannel;
    const nextRelatedChannels = relatedChannels.map((channel) =>
      channel.ids.id === channelId ? buildUnreadClearedChannel(channel, input) : channel,
    );

    const matched =
      nextPrimaryChannel !== primaryChannel ||
      nextRelatedChannels.some((channel, index) => channel !== relatedChannels[index]);

    if (!matched) {
      return space;
    }

    changed = true;
    return {
      ...space,
      channels: {
        ...space.channels,
        primaryChannel: nextPrimaryChannel,
        relatedChannels: nextRelatedChannels,
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
      learningSpaces: nextLearningSpaces,
    },
  };
}

function buildUnreadIncrementedChannel(
  channel: SidebarLeftDataVM['collections']['learningSpaces'][number]['channels']['primaryChannel'],
) {
  const currentUnread = Math.max(0, channel.collections.readState?.unreadCount ?? 0);
  return {
    ...channel,
    collections: {
      ...channel.collections,
      readState: {
        ...channel.collections.readState,
        channelId: channel.collections.readState?.channelId ?? channel.ids.id,
        unreadCount: currentUnread + 1,
      },
    },
  };
}

function buildUnreadClearedChannel(
  channel: SidebarLeftDataVM['collections']['learningSpaces'][number]['channels']['primaryChannel'],
  input?: { lastReadMessageId?: UUID | null; lastReadAt?: ISODateTime | null },
) {
  const currentUnread = Math.max(0, channel.collections.readState?.unreadCount ?? 0);
  const currentThreadUnread = Math.max(
    0,
    channel.collections.readState?.threadUnreadCount ?? 0,
  );
  if (
    currentUnread === 0 &&
    currentThreadUnread === 0 &&
    input?.lastReadMessageId === undefined &&
    input?.lastReadAt === undefined
  ) {
    return channel;
  }

  return {
    ...channel,
    collections: {
      ...channel.collections,
      readState: {
        ...channel.collections.readState,
        channelId: channel.collections.readState?.channelId ?? channel.ids.id,
        lastReadMessageId:
          input?.lastReadMessageId ?? channel.collections.readState?.lastReadMessageId,
        lastReadAt: input?.lastReadAt ?? channel.collections.readState?.lastReadAt,
        unreadCount: 0,
        threadUnreadCount: 0,
      },
    },
  };
}
