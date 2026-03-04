import type { SidebarLeftDataVM } from '@iconicedu/shared-types';

export function applyInboxUnreadCount(
  sidebarData: SidebarLeftDataVM,
  unreadCount: number,
): SidebarLeftDataVM {
  const normalizedUnreadCount = Math.max(0, unreadCount);

  return {
    ...sidebarData,
    navigation: {
      ...sidebarData.navigation,
      navMain: sidebarData.navigation.navMain.map((item) =>
        item.icon === 'inbox'
          ? {
              ...item,
              count: normalizedUnreadCount || undefined,
            }
          : item,
      ),
    },
  };
}
