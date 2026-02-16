import { describe, expect, it } from 'vitest';

import {
  getDirectMessageItemUnreadCount,
  getDirectMessageUnreadCount,
  getLearningSpaceItemUnreadCount,
  getLearningSpaceItemUnreadCountForUser,
  getLearningSpaceUnreadCount,
} from './sidebar-unread';

describe('getDirectMessageUnreadCount', () => {
  it('sums unread counts across direct message channels', () => {
    const total = getDirectMessageUnreadCount([
      { collections: { readState: { unreadCount: 2 } } },
      { collections: { readState: { unreadCount: 3 } } },
      { collections: { readState: null } },
      { collections: {} },
    ] as any);

    expect(total).toBe(5);
  });

  it('ignores negative unread counts', () => {
    const total = getDirectMessageUnreadCount([
      { collections: { readState: { unreadCount: -10 } } },
      { collections: { readState: { unreadCount: 4 } } },
    ] as any);

    expect(total).toBe(4);
  });

  it('falls back to one unread for first incoming message when read state is not persisted yet', () => {
    const total = getDirectMessageUnreadCount(
      [
        {
          collections: {
            readState: { unreadCount: 0, lastReadAt: null, lastReadMessageId: null },
            messages: {
              items: [
                {
                  core: {
                    sender: { ids: { accountId: 'account-other' } },
                  },
                },
              ],
            },
          },
        },
      ] as any,
      'account-self',
    );

    expect(total).toBe(1);
  });

  it('does not apply fallback unread when a read marker exists', () => {
    const unread = getDirectMessageItemUnreadCount(
      {
        collections: {
          readState: {
            unreadCount: 0,
            lastReadAt: '2026-02-16T00:00:00.000Z',
            lastReadMessageId: null,
          },
          messages: {
            items: [
              {
                core: {
                  sender: { ids: { accountId: 'account-other' } },
                },
              },
            ],
          },
        },
      } as any,
      'account-self',
    );

    expect(unread).toBe(0);
  });
});

describe('learning space unread helpers', () => {
  it('sums unread counts across learning spaces', () => {
    const total = getLearningSpaceUnreadCount([
      { channels: { primaryChannel: { collections: { readState: { unreadCount: 2 } } } } },
      { channels: { primaryChannel: { collections: { readState: { unreadCount: 3 } } } } },
      { channels: { primaryChannel: { collections: { readState: null } } } },
    ] as any);

    expect(total).toBe(5);
  });

  it('ignores negative unread counts for learning spaces', () => {
    const unread = getLearningSpaceItemUnreadCount({
      channels: { primaryChannel: { collections: { readState: { unreadCount: -7 } } } },
    } as any);

    expect(unread).toBe(0);
  });

  it('falls back to one unread for first incoming learning space message', () => {
    const unread = getLearningSpaceItemUnreadCountForUser(
      {
        channels: {
          primaryChannel: {
            collections: {
              readState: { unreadCount: 0, lastReadAt: null, lastReadMessageId: null },
              messages: {
                items: [
                  {
                    core: {
                      sender: { ids: { accountId: 'account-other' } },
                    },
                  },
                ],
              },
            },
          },
        },
      } as any,
      { accountId: 'account-self', profileId: 'profile-self' },
    );

    expect(unread).toBe(1);
  });

  it('aggregates unread across primary and related channels', () => {
    const unread = getLearningSpaceUnreadCount(
      [
        {
          channels: {
            primaryChannel: { collections: { readState: { unreadCount: 2 } } },
            relatedChannels: [
              { collections: { readState: { unreadCount: 1 } } },
              { collections: { readState: { unreadCount: 3 } } },
            ],
          },
        },
      ] as any,
      { accountId: 'account-self', profileId: 'profile-self' },
    );

    expect(unread).toBe(6);
  });

  it('treats sender profile id as own message for educators when account id is missing', () => {
    const unread = getLearningSpaceItemUnreadCountForUser(
      {
        channels: {
          primaryChannel: {
            collections: {
              readState: { unreadCount: 0, lastReadAt: null, lastReadMessageId: null },
              messages: {
                items: [
                  {
                    core: {
                      sender: { ids: { id: 'profile-educator' } },
                    },
                  },
                ],
              },
            },
          },
        },
      } as any,
      { accountId: 'account-educator', profileId: 'profile-educator' },
    );

    expect(unread).toBe(0);
  });
});
