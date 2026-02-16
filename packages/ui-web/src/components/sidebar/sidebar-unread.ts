import type { ChannelVM, LearningSpaceVM } from '@iconicedu/shared-types';

type CurrentUserRef = {
  accountId?: string;
  profileId?: string;
};

function getLatestMessage(channel: ChannelVM) {
  const messages = channel.collections.messages?.items ?? [];
  if (!messages.length) {
    return null;
  }
  return messages[messages.length - 1] ?? null;
}

function getLearningSpaceChannels(space: LearningSpaceVM): ChannelVM[] {
  const related = space.channels.relatedChannels ?? [];
  return [space.channels.primaryChannel, ...related];
}

export function getDirectMessageItemUnreadCount(
  channel: ChannelVM,
  currentUserId?: string,
): number {
  const persistedUnread = Math.max(0, channel.collections.readState?.unreadCount ?? 0);
  if (persistedUnread > 0) {
    return persistedUnread;
  }

  if (!currentUserId) {
    return persistedUnread;
  }

  const hasReadMarkers =
    Boolean(channel.collections.readState?.lastReadAt) ||
    Boolean(channel.collections.readState?.lastReadMessageId);
  if (hasReadMarkers) {
    return 0;
  }

  const latestMessage = getLatestMessage(channel);
  if (!latestMessage) {
    return 0;
  }

  const senderAccountId = latestMessage.core.sender?.ids.accountId;
  if (!senderAccountId || senderAccountId === currentUserId) {
    return 0;
  }

  return 1;
}

export function getDirectMessageUnreadCount(
  directMessages: ChannelVM[],
  currentUserId?: string,
): number {
  return directMessages.reduce((total, channel) => {
    return total + getDirectMessageItemUnreadCount(channel, currentUserId);
  }, 0);
}

export function getLearningSpaceItemUnreadCount(space: LearningSpaceVM): number {
  return getLearningSpaceChannels(space).reduce((total, channel) => {
    return total + Math.max(0, channel.collections.readState?.unreadCount ?? 0);
  }, 0);
}

export function getLearningSpaceItemUnreadCountForUser(
  space: LearningSpaceVM,
  currentUser?: CurrentUserRef,
): number {
  const channels = getLearningSpaceChannels(space);
  const persistedUnread = channels.reduce((total, channel) => {
    return total + Math.max(0, channel.collections.readState?.unreadCount ?? 0);
  }, 0);
  if (persistedUnread > 0) {
    return persistedUnread;
  }

  if (!currentUser?.accountId && !currentUser?.profileId) {
    return 0;
  }

  return channels.reduce((total, channel) => {
    const hasReadMarkers =
      Boolean(channel.collections.readState?.lastReadAt) ||
      Boolean(channel.collections.readState?.lastReadMessageId);
    if (hasReadMarkers) {
      return total;
    }

    const latestMessage = getLatestMessage(channel);
    if (!latestMessage) {
      return total;
    }

    const senderIds = latestMessage.core.sender?.ids;
    const isOwnMessage =
      (Boolean(currentUser?.accountId) && senderIds?.accountId === currentUser.accountId) ||
      (Boolean(currentUser?.profileId) && senderIds?.id === currentUser.profileId);
    if (isOwnMessage) {
      return total;
    }

    return total + 1;
  }, 0);
}

export function getLearningSpaceUnreadCount(
  learningSpaces: LearningSpaceVM[],
  currentUser?: CurrentUserRef,
): number {
  return learningSpaces.reduce((total, space) => {
    return total + getLearningSpaceItemUnreadCountForUser(space, currentUser);
  }, 0);
}
