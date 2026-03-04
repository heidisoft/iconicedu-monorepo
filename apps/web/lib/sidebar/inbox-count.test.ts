import { describe, expect, it } from 'vitest';

import { applyInboxUnreadCount } from '@iconicedu/web/lib/sidebar/inbox-count';

describe('applyInboxUnreadCount', () => {
  it('sets the inbox nav count without changing other nav items', () => {
    const sidebarData = {
      navigation: {
        navMain: [
          { title: 'Home', url: '/iconic-academy', icon: 'home' },
          { title: 'Inbox', url: '/iconic-academy/inbox', icon: 'inbox' },
        ],
        navSecondary: [],
      },
      user: {} as never,
      collections: {
        learningSpaces: [],
        directMessages: [],
      },
    } as const;

    expect(applyInboxUnreadCount(sidebarData as never, 4).navigation.navMain).toEqual([
      { title: 'Home', url: '/iconic-academy', icon: 'home' },
      { title: 'Inbox', url: '/iconic-academy/inbox', icon: 'inbox', count: 4 },
    ]);
  });

  it('removes the badge count when unread drops to zero', () => {
    const sidebarData = {
      navigation: {
        navMain: [
          {
            title: 'Inbox',
            url: '/iconic-academy/inbox',
            icon: 'inbox',
            count: 3,
          },
        ],
        navSecondary: [],
      },
      user: {} as never,
      collections: {
        learningSpaces: [],
        directMessages: [],
      },
    } as const;

    expect(applyInboxUnreadCount(sidebarData as never, 0).navigation.navMain[0]).toEqual({
      title: 'Inbox',
      url: '/iconic-academy/inbox',
      icon: 'inbox',
      count: undefined,
    });
  });
});
