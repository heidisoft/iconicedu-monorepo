import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  ActivityFeedTabVM,
  ClassSessionFeedbackRow,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapActivityFeedItemRow } from '@iconicedu/web/lib/activity-feed/mappers/activity-feed.mapper';
import {
  getActivityFeedItemsByOrg,
  getClassSessionFeedbackByProfileAndSessions,
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

type ClassSessionFeedbackSummary = Pick<
  ClassSessionFeedbackRow,
  | 'source_event_id'
  | 'message_id'
  | 'class_session_id'
  | 'classroom_id'
  | 'channel_id'
  | 'occurrence_start_at'
  | 'rating'
  | 'comment'
  | 'submitted_at'
>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getFeedbackClassSessionId(item: ActivityFeedItemVM) {
  const metadata = asRecord(item.metadata);
  if (typeof metadata.classSessionId === 'string') return metadata.classSessionId;
  if (typeof metadata.scheduleId === 'string') return metadata.scheduleId;
  return null;
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
}

function mapFeedbackResponse(row: ClassSessionFeedbackSummary) {
  return {
    sourceEventId: row.source_event_id,
    messageId: row.message_id,
    classSessionId: row.class_session_id,
    classroomId: row.classroom_id,
    channelId: row.channel_id,
    occurrenceStartAt: row.occurrence_start_at,
    rating: row.rating,
    comment: row.comment,
    submittedAt: row.submitted_at,
  };
}

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
  const feedbackResponses = await loadFeedbackResponses(
    supabase,
    orgId,
    profileId,
    mappedItems,
  );
  const itemsWithFeedback = mappedItems.map((item) => {
    if (item.kind !== 'leaf' || item.verb !== 'session.feedback_request.sent') {
      return item;
    }

    const feedbackClassSessionId = getFeedbackClassSessionId(item);
    if (!feedbackClassSessionId) return item;

    const feedbackResponse = feedbackResponses.get(feedbackClassSessionId);
    if (!feedbackResponse) return item;

    return {
      ...item,
      metadata: {
        ...(item.metadata ?? {}),
        feedbackResponse: mapFeedbackResponse(feedbackResponse),
      },
    } as ActivityFeedLeafItemVM;
  });

  const filteredItems =
    activeTab === 'all'
      ? itemsWithFeedback
      : itemsWithFeedback.filter((item) => item.tabKey === activeTab);

  const sections = buildActivitySections(filteredItems);
  const tabs = buildFeedTabs(itemsWithFeedback);
  const unreadCount = countUnreadItems(itemsWithFeedback);

  return {
    activeTab,
    tabs,
    sections,
    nextCursor: null,
    unreadCount,
  };
}

async function loadFeedbackResponses(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
  items: ActivityFeedItemVM[],
) {
  const feedbackClassSessionIds = Array.from(
    new Set(
      items
        .filter((item) => item.kind === 'leaf')
        .filter((item) => item.verb === 'session.feedback_request.sent')
        .map(getFeedbackClassSessionId)
        .filter(isNonEmptyString),
    ),
  );
  if (!profileId || !feedbackClassSessionIds.length) {
    return new Map<string, ClassSessionFeedbackSummary>();
  }

  const feedbackResponse = await getClassSessionFeedbackByProfileAndSessions(
    supabase,
    orgId,
    profileId,
    feedbackClassSessionIds,
  );
  return new Map((feedbackResponse.data ?? []).map((row) => [row.class_session_id, row]));
}

export async function buildActivityFeedUnreadCountForProfile(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
) {
  const itemsResponse = await getActivityFeedItemsByOrg(supabase, orgId, profileId);
  const itemRows = itemsResponse.data ?? [];
  const mappedItems = itemRows.map((row) => mapActivityFeedItemRow(row));
  return countUnreadItems(mappedItems);
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
  const actorEntries: Array<[string, ActivityFeedItemVM['refs']['actor']]> =
    await Promise.all(
      profileRows.map(async (row) => [
        row.id,
        await buildUserProfileFromRow(supabase, row),
      ]),
    );

  return new Map(actorEntries);
}

function buildFeedTabs(items: ActivityFeedItemVM[]): ActivityFeedTabVM[] {
  const counts = new Map<InboxTabKeyVM, number>();
  items.forEach((item) => {
    const unreadItemCount = getUnreadCountForItem(item);

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
        : (counts.get(tab.key) ?? 0),
  }));
}

function getUnreadCountForItem(item: ActivityFeedItemVM) {
  return item.state?.isRead ? 0 : 1;
}

function countUnreadItems(items: ActivityFeedItemVM[]) {
  return items.reduce((total, item) => total + getUnreadCountForItem(item), 0);
}

function buildActivitySections(items: ActivityFeedItemVM[]) {
  if (!items.length) {
    return [];
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const today: ActivityFeedItemVM[] = [];
  const yesterday: ActivityFeedItemVM[] = [];
  const thisWeek: ActivityFeedItemVM[] = [];
  const older: ActivityFeedItemVM[] = [];

  items.forEach((item) => {
    const occurredAt = new Date(item.timestamps.occurredAt);
    if (occurredAt >= startOfToday) {
      today.push(item);
      return;
    }

    if (occurredAt >= startOfYesterday) {
      yesterday.push(item);
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
  if (yesterday.length) {
    sections.push({ label: 'Yesterday', items: yesterday });
  }
  if (thisWeek.length) {
    sections.push({ label: 'This week', items: thisWeek });
  }
  if (older.length) {
    sections.push({ label: 'Earlier', items: older });
  }

  return sections;
}
