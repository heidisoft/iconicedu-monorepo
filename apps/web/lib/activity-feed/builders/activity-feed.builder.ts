import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapActivityFeedItemRow } from '@iconicedu/web/lib/activity-feed/mappers/activity-feed.mapper';
import {
  getActivityFeedGroupMembersByGroupIds,
  getActivityFeedItemsByOrg,
} from '@iconicedu/web/lib/activity-feed/queries/activity-feed.query';
import { buildUserProfileFromRow } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';

const FEED_TABS: Array<{ key: InboxTabKeyVM; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'classes', label: 'Classes' },
  { key: 'payment', label: 'Payment' },
  { key: 'system', label: 'System' },
];

type BuildActivityFeedOptions = {
  activeTab?: InboxTabKeyVM;
};

export async function buildActivityFeedForProfile(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
  options: BuildActivityFeedOptions = {},
): Promise<ActivityFeedVM> {
  const { activeTab = 'all' } = options;
  const itemsResponse = await getActivityFeedItemsByOrg(supabase, orgId, profileId);
  const itemRows = itemsResponse.data ?? [];

  const actorProfiles = await loadActivityFeedActors(supabase, orgId, itemRows);
  const mappedItems = itemRows.map((row) =>
    mapActivityFeedItemRow(row, {
      actor: row.actor_profile_id ? actorProfiles.get(row.actor_profile_id) : null,
    }),
  );

  const groupedItems = await attachGroupMembers(
    supabase,
    orgId,
    mappedItems,
  );

  const filteredItems =
    activeTab === 'all'
      ? groupedItems
      : groupedItems.filter((item) => item.tabKey === activeTab);

  const sections = buildActivitySections(filteredItems);
  const tabs = buildFeedTabs(mappedItems);
  const unreadCount = mappedItems.filter((item) => !item.state?.isRead).length;

  return {
    activeTab,
    tabs,
    sections,
    nextCursor: null,
    unreadCount,
  };
}

export async function buildActivityFeedByOrg(
  supabase: SupabaseClient,
  orgId: string,
  options: BuildActivityFeedOptions = {},
) {
  return buildActivityFeedForProfile(supabase, orgId, '', options);
}

async function loadActivityFeedActors(
  supabase: SupabaseClient,
  orgId: string,
  itemRows: Array<{ actor_profile_id?: string | null }>,
): Promise<Map<string, ActivityFeedItemVM['refs']['actor']>> {
  const actorIds = Array.from(
    new Set(itemRows.map((row) => row.actor_profile_id).filter(Boolean)),
  ) as string[];

  if (!actorIds.length) {
    return new Map<string, ActivityFeedItemVM['refs']['actor']>();
  }

  const profilesResponse = await getProfilesByIds(supabase, orgId, actorIds);
  const profileRows = profilesResponse.data ?? [];
  const actorEntries: Array<[string, ActivityFeedItemVM['refs']['actor']]> = await Promise.all(
    profileRows.map(async (row) => [
      row.id,
      await buildUserProfileFromRow(supabase, row),
    ]),
  );

  return new Map(actorEntries);
}

async function attachGroupMembers(
  supabase: SupabaseClient,
  orgId: string,
  items: ActivityFeedItemVM[],
) {
  const groupIds = items
    .filter((item) => item.kind === 'group')
    .map((item) => item.ids.id);

  if (!groupIds.length) {
    return items;
  }

  const groupMembersResponse = await getActivityFeedGroupMembersByGroupIds(
    supabase,
    orgId,
    groupIds,
  );
  const groupMembers = groupMembersResponse.data ?? [];

  const itemMap = new Map(items.map((item) => [item.ids.id, item]));
  const membersByGroup = new Map<string, string[]>();
  groupMembers.forEach((member) => {
    const list = membersByGroup.get(member.group_id) ?? [];
    list.push(member.item_id);
    membersByGroup.set(member.group_id, list);
  });

  const groupedMemberIds = new Set<string>();
  const withGroups = items.map((item) => {
    if (item.kind !== 'group') {
      return item;
    }

    const memberIds = membersByGroup.get(item.ids.id) ?? [];
    const members = memberIds
      .map((memberId) => itemMap.get(memberId))
      .filter(
        (member): member is ActivityFeedLeafItemVM =>
          member !== undefined && member.kind === 'leaf',
      );

    memberIds.forEach((memberId) => groupedMemberIds.add(memberId));

    return {
      ...item,
      subActivities: {
        items: members,
      },
      subActivityCount: item.subActivityCount ?? members.length,
    } as ActivityFeedItemVM;
  });

  return withGroups.filter(
    (item) => item.kind === 'group' || !groupedMemberIds.has(item.ids.id),
  );
}

function buildFeedTabs(items: ActivityFeedItemVM[]): ActivityFeedTabVM[] {
  const counts = new Map<InboxTabKeyVM, number>();
  items.forEach((item) => {
    const unreadItemCount =
      item.kind === 'group'
        ? item.subActivities?.items.filter((subItem) => !subItem.state?.isRead).length ??
          (!item.state?.isRead ? 1 : 0)
        : !item.state?.isRead
          ? 1
          : 0;

    if (unreadItemCount === 0) {
      return;
    }

    counts.set(item.tabKey, (counts.get(item.tabKey) ?? 0) + unreadItemCount);
  });

  return FEED_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    badgeCount:
      tab.key === 'all'
        ? Array.from(counts.values()).reduce((total, count) => total + count, 0)
        : counts.get(tab.key) ?? 0,
  }));
}

function buildActivitySections(items: ActivityFeedItemVM[]) {
  if (!items.length) {
    return [];
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const today: ActivityFeedItemVM[] = [];
  const thisWeek: ActivityFeedItemVM[] = [];
  const older: ActivityFeedItemVM[] = [];

  items.forEach((item) => {
    const occurredAt = new Date(item.timestamps.occurredAt);
    if (occurredAt >= startOfToday) {
      today.push(item);
      return;
    }

    if (occurredAt >= startOfWeek) {
      thisWeek.push(item);
      return;
    }

    older.push(item);
  });

  const sections = [];
  if (today.length) {
    sections.push({ label: 'Today', items: today });
  }
  if (thisWeek.length) {
    sections.push({ label: 'This week', items: thisWeek });
  }
  if (older.length) {
    sections.push({ label: 'Earlier', items: older });
  }

  return sections;
}
