import type { ISODateTime, MessageVM, UUID } from '@iconicedu/shared-types';

import { findLatestIncomingMessageId } from '@iconicedu/ui-web/components/messages/read-state.utils';

export function findUnreadAnchorMessageId(input: {
  sortedMessages: MessageVM[];
  lastReadMessageId?: UUID;
  lastReadAt?: ISODateTime;
  currentUserId?: UUID;
}): UUID | null {
  const { sortedMessages, lastReadMessageId, lastReadAt, currentUserId } = input;
  if (!lastReadMessageId && !lastReadAt) {
    return null;
  }

  let lastReadIndex = -1;
  if (lastReadMessageId) {
    lastReadIndex = sortedMessages.findIndex(
      (message) => message.ids.id === lastReadMessageId,
    );
  } else if (lastReadAt) {
    const lastReadAtTime = new Date(lastReadAt).getTime();
    for (let index = sortedMessages.length - 1; index >= 0; index -= 1) {
      const createdAtTime = new Date(sortedMessages[index].core.createdAt).getTime();
      if (createdAtTime <= lastReadAtTime) {
        lastReadIndex = index;
        break;
      }
    }
  }

  if (lastReadIndex < 0 && lastReadAt) {
    // Timestamp exists but no messages were read in this page; treat first as unread start.
    lastReadIndex = -1;
  }

  if (lastReadIndex < 0 || lastReadIndex >= sortedMessages.length - 1) {
    if (lastReadAt && sortedMessages.length > 0 && lastReadIndex < 0) {
      const unreadStart = sortedMessages.find((message) =>
        currentUserId ? message.core.sender.ids.id !== currentUserId : true,
      );
      return unreadStart?.ids.id ?? null;
    }
    return null;
  }

  const unreadStart = sortedMessages
    .slice(lastReadIndex + 1)
    .find((message) =>
      currentUserId ? message.core.sender.ids.id !== currentUserId : true,
    );

  return unreadStart?.ids.id ?? null;
}

export function findLatestUnreadIncomingMessageId(input: {
  sortedMessages: MessageVM[];
  lastReadMessageId?: UUID;
  lastReadAt?: ISODateTime;
  currentUserId?: UUID;
}): UUID | null {
  const { sortedMessages, lastReadMessageId, lastReadAt, currentUserId } = input;

  if (!lastReadMessageId && !lastReadAt) {
    return findLatestIncomingMessageId(sortedMessages, currentUserId);
  }

  const unreadAnchorMessageId = findUnreadAnchorMessageId(input);
  if (!unreadAnchorMessageId) {
    return null;
  }

  const unreadStartIndex = sortedMessages.findIndex(
    (message) => message.ids.id === unreadAnchorMessageId,
  );
  if (unreadStartIndex < 0) {
    return null;
  }

  for (let index = sortedMessages.length - 1; index >= unreadStartIndex; index -= 1) {
    const message = sortedMessages[index];
    if (!currentUserId || message.core.sender.ids.id !== currentUserId) {
      return message.ids.id;
    }
  }

  return null;
}
