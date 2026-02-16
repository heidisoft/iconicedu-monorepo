import type { ChannelVM } from '@iconicedu/shared-types';

function getLatestMessage(channel: ChannelVM) {
  const messages = channel.collections.messages?.items ?? [];
  if (!messages.length) {
    return null;
  }
  return messages[messages.length - 1] ?? null;
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
