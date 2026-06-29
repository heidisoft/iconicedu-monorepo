import type { ActivityFeedVM } from '@iconicedu/shared-types';
import { apiGet, apiPost } from '@/lib/api/http-client';

export async function fetchActivityFeed(
  orgId: string,
  profileId: string,
): Promise<ActivityFeedVM> {
  return apiGet('/activity-feed', { orgId, profileId });
}

export async function fetchUnreadBadgeCount(orgId: string): Promise<number> {
  const response = await apiGet<{ unreadCount?: number }>(
    '/activity-feed/unread-badge-count',
    { orgId },
  );
  return Math.max(0, response.unreadCount ?? 0);
}

export async function markActivityFeedRead(
  orgId: string,
  profileId: string,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  await apiPost('/activity-feed/read', { orgId, profileId, ids });
}
