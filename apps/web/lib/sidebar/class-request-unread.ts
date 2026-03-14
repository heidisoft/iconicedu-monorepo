import type { SidebarLeftDataVM } from '@iconicedu/shared-types';

type SidebarWithClassRequestNav = Pick<SidebarLeftDataVM, 'navigation' | 'collections'>;

function getClassRequestUnreadCount(sidebarData: SidebarWithClassRequestNav) {
  return (sidebarData.collections.classRequestChannels ?? []).reduce(
    (total, channel) =>
      total + Math.max(0, channel.collections.readState?.unreadCount ?? 0),
    0,
  );
}

export function applyClassRequestUnreadCount<T extends SidebarWithClassRequestNav>(
  sidebarData: T,
  unreadCount: number,
): T {
  const normalizedUnreadCount = Math.max(0, unreadCount);

  return {
    ...sidebarData,
    navigation: {
      ...sidebarData.navigation,
      navMain: sidebarData.navigation.navMain.map((item) =>
        item.title === 'Class Requests'
          ? {
              ...item,
              count: normalizedUnreadCount || undefined,
            }
          : item,
      ),
    },
  } as T;
}

export function syncClassRequestUnreadCount<T extends SidebarWithClassRequestNav>(
  sidebarData: T,
) {
  return applyClassRequestUnreadCount(
    sidebarData,
    getClassRequestUnreadCount(sidebarData),
  );
}
