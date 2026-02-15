import type { MessageVM, UUID } from '@iconicedu/shared-types';

export function findLatestIncomingMessageId(
  messages: MessageVM[],
  currentUserId?: UUID,
): UUID | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!currentUserId || message.core.sender.ids.id !== currentUserId) {
      return message.ids.id;
    }
  }
  return null;
}
