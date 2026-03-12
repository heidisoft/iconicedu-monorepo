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

export function applyInboxUnreadDelta(
  sidebarData: SidebarLeftDataVM,
  delta: number,
): SidebarLeftDataVM {
  const currentInboxCount =
    sidebarData.navigation.navMain.find((item) => item.icon === 'inbox')?.count ?? 0;
  return applyInboxUnreadCount(sidebarData, Math.max(0, currentInboxCount + delta));
}

type InboxRealtimeRow = {
  recipient_profile_id?: string | null;
  is_read?: boolean | null;
} | null;

export function getInboxUnreadDeltaFromRealtime(input: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  currentProfileId: string;
  nextRow?: InboxRealtimeRow;
  previousRow?: InboxRealtimeRow;
}) {
  const isUnread = (row: InboxRealtimeRow) =>
    Boolean(row?.recipient_profile_id) && row?.is_read !== true;
  const isOwned = (row: InboxRealtimeRow) =>
    row?.recipient_profile_id === input.currentProfileId;

  if (input.eventType === 'INSERT') {
    return isOwned(input.nextRow ?? null) && isUnread(input.nextRow ?? null) ? 1 : 0;
  }

  if (input.eventType === 'DELETE') {
    return isOwned(input.previousRow ?? null) && isUnread(input.previousRow ?? null)
      ? -1
      : 0;
  }

  const previousUnread =
    isOwned(input.previousRow ?? null) && isUnread(input.previousRow ?? null);
  const nextUnread = isOwned(input.nextRow ?? null) && isUnread(input.nextRow ?? null);
  if (previousUnread === nextUnread) {
    return 0;
  }
  return nextUnread ? 1 : -1;
}
