import type { MessageVM, UUID } from '@iconicedu/shared-types';

export function buildThreadRepliesByParent(
  messages: MessageVM[],
): Map<UUID, MessageVM[]> {
  const replies = new Map<UUID, MessageVM[]>();
  messages.forEach((candidate) => {
    const thread = candidate.social.thread;
    if (!thread) return;
    const parentId = thread.parent.messageId;
    if (!parentId || candidate.ids.id === parentId) return;
    const existing = replies.get(parentId) ?? [];
    existing.push(candidate);
    replies.set(parentId, existing);
  });
  return replies;
}

export function getInlineReplyPreview(message: MessageVM): string {
  if ('content' in message && message.content && 'text' in message.content) {
    const value = message.content.text;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return 'Shared an update';
}
