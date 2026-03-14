/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MessageVM } from '@iconicedu/shared-types';

import { useMessages } from './use-messages';

function createMessage(overrides?: Partial<MessageVM>): MessageVM {
  return {
    ids: { id: 'message-1', orgId: 'org-1' },
    core: {
      type: 'text',
      createdAt: '2026-03-14T10:00:00.000Z',
      visibility: { type: 'all' },
      sender: {
        ids: { id: 'profile-2', orgId: 'org-1', accountId: 'account-2' },
      },
    },
    social: {
      reactions: [],
      thread: {
        ids: { id: 'thread-1', orgId: 'org-1' },
        parent: { messageId: 'message-1' },
        stats: { messageCount: 1, lastReplyAt: '2026-03-14T10:00:00.000Z' },
        participants: [],
      },
    },
    content: { text: 'hello' },
    ...overrides,
  } as MessageVM;
}

describe('useMessages reactions', () => {
  it('keeps first-click reacted state after a richer server update', () => {
    const initialMessage = createMessage({
      social: {
        reactions: [
          { emoji: '👍', count: 1, reactedByMe: false, sampleUserIds: ['profile-2'] },
        ],
        thread: createMessage().social.thread,
      },
    });
    const { result } = renderHook(() => useMessages([initialMessage]));

    act(() => {
      result.current.toggleReaction('message-1', '👍', 'profile-1');
    });

    expect(result.current.messages[0].social.reactions).toEqual([
      {
        emoji: '👍',
        count: 2,
        reactedByMe: true,
        sampleUserIds: ['profile-1', 'profile-2'],
      },
    ]);

    act(() => {
      result.current.updateMessage('message-1', {
        social: {
          reactions: [
            {
              emoji: '👍',
              count: 2,
              reactedByMe: true,
              sampleUserIds: ['profile-1', 'profile-2'],
            },
          ],
        } as MessageVM['social'],
      });
    });

    expect(result.current.messages[0].social.reactions).toEqual([
      {
        emoji: '👍',
        count: 2,
        reactedByMe: true,
        sampleUserIds: ['profile-1', 'profile-2'],
      },
    ]);
    expect(result.current.messages[0].social.thread?.ids.id).toBe('thread-1');
  });

  it('keeps unreact state after a server update', () => {
    const initialMessage = createMessage({
      social: {
        reactions: [
          {
            emoji: '👍',
            count: 2,
            reactedByMe: true,
            sampleUserIds: ['profile-1', 'profile-2'],
          },
        ],
        thread: createMessage().social.thread,
      },
    });
    const { result } = renderHook(() => useMessages([initialMessage]));

    act(() => {
      result.current.toggleReaction('message-1', '👍', 'profile-1');
    });

    expect(result.current.messages[0].social.reactions).toEqual([
      {
        emoji: '👍',
        count: 1,
        reactedByMe: false,
        sampleUserIds: ['profile-2'],
      },
    ]);

    act(() => {
      result.current.updateMessage('message-1', {
        social: {
          reactions: [
            {
              emoji: '👍',
              count: 1,
              reactedByMe: false,
              sampleUserIds: ['profile-2'],
            },
          ],
        } as MessageVM['social'],
      });
    });

    expect(result.current.messages[0].social.reactions).toEqual([
      {
        emoji: '👍',
        count: 1,
        reactedByMe: false,
        sampleUserIds: ['profile-2'],
      },
    ]);
    expect(result.current.messages[0].social.thread?.ids.id).toBe('thread-1');
  });
});
