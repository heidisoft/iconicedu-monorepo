import type { MessageVM, ThreadVM } from '@iconicedu/shared-types';

export function resolveThreadAfterReply(input: {
  currentThread: ThreadVM;
  sentMessage: MessageVM;
  replyCount: number;
  now: string;
}): {
  thread: ThreadVM;
  message: MessageVM;
  wasRekeyed: boolean;
} {
  const persistedThread = input.sentMessage.social.thread;

  const thread = persistedThread
    ? {
        ...persistedThread,
        stats: {
          ...persistedThread.stats,
          messageCount: Math.max(
            persistedThread.stats.messageCount,
            input.replyCount + 1,
          ),
          lastReplyAt: input.now,
        },
      }
    : {
        ...input.currentThread,
        stats: {
          ...input.currentThread.stats,
          messageCount: Math.max(
            input.currentThread.stats.messageCount + 1,
            input.replyCount + 1,
          ),
          lastReplyAt: input.now,
        },
      };

  const message = persistedThread
    ? input.sentMessage
    : {
        ...input.sentMessage,
        social: {
          ...input.sentMessage.social,
          thread,
        },
      };

  return {
    thread,
    message,
    wasRekeyed: thread.ids.id !== input.currentThread.ids.id,
  };
}
