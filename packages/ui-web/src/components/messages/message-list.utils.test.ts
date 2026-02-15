import { describe, expect, it } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import {
  prependUniqueMessages,
  removeMessageById,
  updateMessageById,
  upsertMessage,
} from './message-list.utils';

function createMessage(
  id: string,
  createdAt: string,
  overrides?: Partial<MessageVM>,
): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      createdAt,
      visibility: { type: 'all' },
      sender: { ids: { id: 'profile-1', orgId: 'org-1' } },
    },
    social: {
      reactions: [],
    },
    content: { text: id },
    ...overrides,
  } as MessageVM;
}

describe('message-list utils', () => {
  it('upserts by id and keeps ascending order', () => {
    const first = createMessage('a', '2026-01-01T10:00:00.000Z');
    const second = createMessage('b', '2026-01-01T11:00:00.000Z');
    const updatedSecond = createMessage('b', '2026-01-01T11:00:00.000Z', {
      content: { text: 'updated' },
    });

    const withSecond = upsertMessage([first], second);
    const withUpdatedSecond = upsertMessage(withSecond, updatedSecond);

    expect(withUpdatedSecond).toHaveLength(2);
    expect(withUpdatedSecond.map((message) => message.ids.id)).toEqual(['a', 'b']);
    expect((withUpdatedSecond[1] as MessageVM & { content?: { text?: string } }).content?.text).toBe(
      'updated',
    );
  });

  it('prepends older messages without duplicates', () => {
    const oldest = createMessage('old', '2026-01-01T09:00:00.000Z');
    const first = createMessage('a', '2026-01-01T10:00:00.000Z');
    const duplicate = createMessage('a', '2026-01-01T10:00:00.000Z');

    const result = prependUniqueMessages([first], [oldest, duplicate]);

    expect(result.map((message) => message.ids.id)).toEqual(['old', 'a']);
  });

  it('deep merges social updates when updating a message', () => {
    const initial = createMessage('a', '2026-01-01T10:00:00.000Z', {
      social: {
        reactions: [{ emoji: '👍', count: 1 }],
      },
    });
    const thread = { ids: { id: 'thread-1', orgId: 'org-1' } };

    const result = updateMessageById([initial], 'a', {
      social: { thread } as MessageVM['social'],
    });

    expect(result[0].social.reactions).toEqual([{ emoji: '👍', count: 1 }]);
    expect(result[0].social.thread?.ids.id).toBe('thread-1');
  });

  it('preserves existing thread link when social update omits thread', () => {
    const initial = createMessage('a', '2026-01-01T10:00:00.000Z', {
      social: {
        reactions: [{ emoji: '👍', count: 1 }],
        thread: { ids: { id: 'thread-1', orgId: 'org-1' } },
      },
    });

    const result = updateMessageById([initial], 'a', {
      social: { reactions: [{ emoji: '👍', count: 2 }] },
    });

    expect(result[0].social.reactions).toEqual([{ emoji: '👍', count: 2 }]);
    expect(result[0].social.thread?.ids.id).toBe('thread-1');
  });

  it('removes a message by id', () => {
    const first = createMessage('a', '2026-01-01T10:00:00.000Z');
    const second = createMessage('b', '2026-01-01T11:00:00.000Z');

    const result = removeMessageById([first, second], 'a');

    expect(result.map((message) => message.ids.id)).toEqual(['b']);
  });
});
