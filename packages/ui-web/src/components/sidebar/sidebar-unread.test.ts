import { describe, expect, it } from 'vitest';
import type { ChannelVM, LearningSpaceVM } from '@iconicedu/shared-types';

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
    ] as unknown as ChannelVM[]);

    expect(total).toBe(5);
  });

  it('includes unread thread replies in direct message totals', () => {
    const total = getDirectMessageUnreadCount([
      { collections: { readState: { unreadCount: 2, threadUnreadCount: 4 } } },
      { collections: { readState: { unreadCount: 0, threadUnreadCount: 3 } } },
    ] as unknown as ChannelVM[]);

    expect(total).toBe(9);
  });

  it('ignores negative unread counts', () => {
    const total = getDirectMessageUnreadCount([
      { collections: { readState: { unreadCount: -10 } } },
      { collections: { readState: { unreadCount: 4 } } },
    ] as unknown as ChannelVM[]);

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
      ] as unknown as ChannelVM[],
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
      } as unknown as ChannelVM,
      'account-self',
    );

    expect(unread).toBe(0);
  });
});

describe('class unread helpers', () => {
  it('sums unread counts across classes', () => {
    const total = getLearningSpaceUnreadCount([
      {
        channels: { primaryChannel: { collections: { readState: { unreadCount: 2 } } } },
      },
      {
        channels: { primaryChannel: { collections: { readState: { unreadCount: 3 } } } },
      },
      { channels: { primaryChannel: { collections: { readState: null } } } },
    ] as unknown as LearningSpaceVM[]);

    expect(total).toBe(5);
  });

  it('includes unread thread replies across class channels', () => {
    const total = getLearningSpaceUnreadCount([
      {
        channels: {
          primaryChannel: {
            collections: { readState: { unreadCount: 2, threadUnreadCount: 1 } },
          },
          relatedChannels: [
            { collections: { readState: { unreadCount: 0, threadUnreadCount: 3 } } },
          ],
        },
      },
    ] as unknown as LearningSpaceVM[]);

    expect(total).toBe(6);
  });

  it('ignores negative unread counts for classes', () => {
    const unread = getLearningSpaceItemUnreadCount({
      channels: { primaryChannel: { collections: { readState: { unreadCount: -7 } } } },
    } as unknown as LearningSpaceVM);

    expect(unread).toBe(0);
  });

  it('falls back to one unread for first incoming class message', () => {
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
      } as unknown as LearningSpaceVM,
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
      ] as unknown as LearningSpaceVM[],
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
      } as unknown as LearningSpaceVM,
      { accountId: 'account-educator', profileId: 'profile-educator' },
    );

    expect(unread).toBe(0);
  });
});
