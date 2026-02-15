import { describe, expect, it } from 'vitest';
import type { MessageVM } from '@iconicedu/shared-types';
import { findUnreadAnchorMessageId } from './unread-indicator.utils';

const baseMessage: MessageVM = {
  ids: { id: 'message-1', orgId: 'org-1' },
  core: {
    type: 'text',
    sender: {
      ids: { id: 'profile-1', orgId: 'org-1', accountId: 'account-1' },
      kind: 'guardian',
      profile: {
        displayName: 'User 1',
        avatar: { url: null, source: 'seed' },
      },
      prefs: {},
      meta: {},
      ui: { themeKey: null },
      joinedDate: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    visibility: { type: 'all' },
  },
  social: { reactions: [] },
  content: { text: 'Hello' },
};

describe('findUnreadAnchorMessageId', () => {
  it('returns first receiver message after last read', () => {
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const mine = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'mine' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T09:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-1' },
        },
      },
    } as MessageVM;
    const incoming = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'incoming' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-2' },
        },
      },
    } as MessageVM;

    expect(
      findUnreadAnchorMessageId({
        sortedMessages: [older, mine, incoming],
        lastReadMessageId: 'older',
        currentUserId: 'profile-1',
      }),
    ).toBe('incoming');
  });

  it('returns null when unread block contains only sender messages', () => {
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const mine = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'mine' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
      },
    } as MessageVM;

    expect(
      findUnreadAnchorMessageId({
        sortedMessages: [older, mine],
        lastReadMessageId: 'older',
        currentUserId: 'profile-1',
      }),
    ).toBeNull();
  });

  it('uses lastReadAt when lastReadMessageId is not available', () => {
    const older = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'older' },
      core: { ...baseMessage.core, createdAt: '2026-02-14T10:00:00.000Z' },
    } as MessageVM;
    const incoming = {
      ...baseMessage,
      ids: { ...baseMessage.ids, id: 'incoming' },
      core: {
        ...baseMessage.core,
        createdAt: '2026-02-15T10:00:00.000Z',
        sender: {
          ...baseMessage.core.sender,
          ids: { ...baseMessage.core.sender.ids, id: 'profile-2' },
        },
      },
    } as MessageVM;

    expect(
      findUnreadAnchorMessageId({
        sortedMessages: [older, incoming],
        lastReadAt: '2026-02-14T20:00:00.000Z',
        currentUserId: 'profile-1',
      }),
    ).toBe('incoming');
  });
});
