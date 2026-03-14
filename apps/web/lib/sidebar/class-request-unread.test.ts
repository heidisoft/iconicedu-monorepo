import { describe, expect, it } from 'vitest';
import type { SidebarLeftDataVM } from '@iconicedu/shared-types';

import {
  applyClassRequestUnreadCount,
  markClassRequestChannelRead,
  syncClassRequestUnreadCount,
} from './class-request-unread';

describe('class request unread helpers', () => {
  it('applies the class request nav badge count', () => {
    const sidebarData = {
      navigation: {
        navMain: [
          {
            title: 'Class Requests',
            url: '/iconic-academy/c/channel-1',
            icon: 'send',
          },
        ],
        navSecondary: [],
      },
      user: {} as never,
      collections: {
        learningSpaces: [],
        directMessages: [],
        classRequestChannels: [],
      },
    } as const;

    expect(
      applyClassRequestUnreadCount(sidebarData as never, 3).navigation.navMain[0],
    ).toEqual({
      title: 'Class Requests',
      url: '/iconic-academy/c/channel-1',
      icon: 'send',
      count: 3,
    });
  });

  it('derives the nav badge from class request channel unread state', () => {
    const sidebarData = {
      navigation: {
        navMain: [
          {
            title: 'Class Requests',
            url: '/iconic-academy/c/channel-1',
            icon: 'send',
          },
        ],
        navSecondary: [],
      },
      user: {} as never,
      collections: {
        learningSpaces: [],
        directMessages: [],
        classRequestChannels: [
          {
            ids: { id: 'channel-1' },
            collections: { readState: { unreadCount: 2 } },
          },
          {
            ids: { id: 'channel-2' },
            collections: { readState: { unreadCount: 1 } },
          },
        ],
      },
    } as unknown as SidebarLeftDataVM;

    expect(syncClassRequestUnreadCount(sidebarData).navigation.navMain[0]?.count).toBe(3);
  });

  it('clears class request unread count when the channel is marked read', () => {
    const sidebarData = {
      navigation: {
        navMain: [
          {
            title: 'Class Requests',
            url: '/iconic-academy/c/channel-1',
            icon: 'send',
            count: 3,
          },
        ],
        navSecondary: [],
      },
      user: {} as never,
      collections: {
        learningSpaces: [],
        directMessages: [],
        classRequestChannels: [
          {
            ids: { id: 'channel-1' },
            collections: {
              readState: {
                unreadCount: 3,
                lastReadAt: null,
                lastReadMessageId: null,
              },
            },
          },
        ],
      },
    } as unknown as SidebarLeftDataVM;

    const updated = markClassRequestChannelRead(sidebarData, 'channel-1', {
      lastReadMessageId: 'message-1',
      lastReadAt: '2026-03-14T12:00:00.000Z',
    });

    expect(updated.collections.classRequestChannels?.[0]?.collections.readState).toEqual(
      expect.objectContaining({
        unreadCount: 0,
        lastReadMessageId: 'message-1',
        lastReadAt: '2026-03-14T12:00:00.000Z',
      }),
    );
    expect(updated.navigation.navMain[0]?.count).toBeUndefined();
  });
});
