import { describe, expect, it } from 'vitest';
import type { MessageVM, ThreadVM } from '@iconicedu/shared-types';
import { resolveThreadAfterReply } from './thread-reply.utils';

function createThread(id: string): ThreadVM {
  return {
    ids: { id, orgId: 'org-1' },
    parent: { messageId: 'parent-1' },
    stats: {
      messageCount: 1,
      lastReplyAt: '2026-01-01T10:00:00.000Z',
    },
    participants: [],
  };
}

function createMessage(thread?: ThreadVM): MessageVM {
  return {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      createdAt: '2026-01-01T10:01:00.000Z',
      visibility: { type: 'all' },
      sender: { ids: { id: 'profile-1', orgId: 'org-1' } },
    },
    social: {
      reactions: [],
      ...(thread ? { thread } : {}),
    },
    content: { text: 'reply' },
  } as MessageVM;
}

describe('resolveThreadAfterReply', () => {
  it('rekeys to persisted thread id returned by API', () => {
    const provisionalThread = createThread('parent-1');
    const persistedThread = createThread('thread-1');
    const message = createMessage(persistedThread);

    const result = resolveThreadAfterReply({
      currentThread: provisionalThread,
      sentMessage: message,
      replyCount: 1,
      now: '2026-01-01T10:02:00.000Z',
    });

    expect(result.thread.ids.id).toBe('thread-1');
    expect(result.message.social.thread?.ids.id).toBe('thread-1');
    expect(result.wasRekeyed).toBe(true);
  });

  it('keeps current thread when API does not return thread', () => {
    const thread = createThread('thread-1');
    const message = createMessage();

    const result = resolveThreadAfterReply({
      currentThread: thread,
      sentMessage: message,
      replyCount: 1,
      now: '2026-01-01T10:02:00.000Z',
    });

    expect(result.thread.ids.id).toBe('thread-1');
    expect(result.message.social.thread?.ids.id).toBe('thread-1');
    expect(result.wasRekeyed).toBe(false);
  });
});

