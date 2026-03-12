import { describe, expect, it } from 'vitest';

import {
  applyInboxUnreadCount,
  applyInboxUnreadDelta,
  getInboxUnreadDeltaFromRealtime,
} from '@iconicedu/web/lib/sidebar/inbox-count';

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

describe('applyInboxUnreadDelta', () => {
  it('adds delta onto current inbox badge count', () => {
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

    expect(
      applyInboxUnreadDelta(sidebarData as never, 2).navigation.navMain[0]?.count,
    ).toBe(5);
    expect(
      applyInboxUnreadDelta(sidebarData as never, -99).navigation.navMain[0]?.count,
    ).toBe(undefined);
  });
});

describe('getInboxUnreadDeltaFromRealtime', () => {
  const profileId = 'profile-1';

  it('increments on unread insert', () => {
    expect(
      getInboxUnreadDeltaFromRealtime({
        eventType: 'INSERT',
        currentProfileId: profileId,
        nextRow: { recipient_profile_id: profileId, is_read: false },
      }),
    ).toBe(1);
  });

  it('decrements on unread delete', () => {
    expect(
      getInboxUnreadDeltaFromRealtime({
        eventType: 'DELETE',
        currentProfileId: profileId,
        previousRow: { recipient_profile_id: profileId, is_read: null },
      }),
    ).toBe(-1);
  });

  it('diffs read transitions on update', () => {
    expect(
      getInboxUnreadDeltaFromRealtime({
        eventType: 'UPDATE',
        currentProfileId: profileId,
        previousRow: { recipient_profile_id: profileId, is_read: false },
        nextRow: { recipient_profile_id: profileId, is_read: true },
      }),
    ).toBe(-1);

    expect(
      getInboxUnreadDeltaFromRealtime({
        eventType: 'UPDATE',
        currentProfileId: profileId,
        previousRow: { recipient_profile_id: profileId, is_read: true },
        nextRow: { recipient_profile_id: profileId, is_read: false },
      }),
    ).toBe(1);
  });

  it('ignores rows not owned by current profile', () => {
    expect(
      getInboxUnreadDeltaFromRealtime({
        eventType: 'INSERT',
        currentProfileId: profileId,
        nextRow: { recipient_profile_id: 'profile-2', is_read: false },
      }),
    ).toBe(0);
  });
});
