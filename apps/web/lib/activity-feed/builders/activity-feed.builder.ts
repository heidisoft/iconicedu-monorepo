import type {
  ActivityFeedItemVM,
  ActivityFeedVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
  ClassSessionFeedbackRow,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapActivityFeedItemRow } from '@iconicedu/web/lib/activity-feed/mappers/activity-feed.mapper';
import { getActivityFeedItemsByOrg } from '@iconicedu/web/lib/activity-feed/queries/activity-feed.query';
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
  const itemsWithFeedback = await attachFeedbackResponses(
    supabase,
    orgId,
    profileId,
    mappedItems,
  );

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

async function attachFeedbackResponses(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
  items: ActivityFeedItemVM[],
) {
  if (typeof (supabase as { from?: unknown }).from !== 'function') {
    return items;
  }

  const sessionIds = items
    .filter((item) => item.verb === 'session.feedback_request.sent')
    .map((item) => item.metadata?.classSessionId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const sourceEventIds = items
    .filter((item) => item.verb === 'session.feedback_request.sent')
    .map((item) => item.metadata?.sourceEventId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  const uniqueSessionIds = Array.from(new Set(sessionIds));
  const uniqueSourceEventIds = Array.from(new Set(sourceEventIds));
  if (!uniqueSessionIds.length && !uniqueSourceEventIds.length) {
    return items;
  }

  const [sessionResponse, eventResponse] = await Promise.all([
    uniqueSessionIds.length
      ? supabase
          .from('class_session_feedback')
          .select(
            'class_session_id, source_event_id, message_id, rating, comment, submitted_at',
          )
          .eq('org_id', orgId)
          .eq('recipient_profile_id', profileId)
          .in('class_session_id', uniqueSessionIds)
          .is('deleted_at', null)
          .returns<
            Pick<
              ClassSessionFeedbackRow,
              | 'class_session_id'
              | 'source_event_id'
              | 'message_id'
              | 'rating'
              | 'comment'
              | 'submitted_at'
            >[]
          >()
      : Promise.resolve({ data: [], error: null }),
    uniqueSourceEventIds.length
      ? supabase
          .from('class_session_feedback')
          .select(
            'class_session_id, source_event_id, message_id, rating, comment, submitted_at',
          )
          .eq('org_id', orgId)
          .eq('recipient_profile_id', profileId)
          .in('source_event_id', uniqueSourceEventIds)
          .is('deleted_at', null)
          .returns<
            Pick<
              ClassSessionFeedbackRow,
              | 'class_session_id'
              | 'source_event_id'
              | 'message_id'
              | 'rating'
              | 'comment'
              | 'submitted_at'
            >[]
          >()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sessionResponse.error) {
    throw new Error(sessionResponse.error.message);
  }
  if (eventResponse.error) {
    throw new Error(eventResponse.error.message);
  }

  const mergedRows = [...(sessionResponse.data ?? []), ...(eventResponse.data ?? [])];
  const feedbackBySessionId = new Map(
    mergedRows
      .filter(
        (row) =>
          typeof row.class_session_id === 'string' && row.class_session_id.length > 0,
      )
      .map((row) => [row.class_session_id, row]),
  );
  const feedbackByEventId = new Map(
    mergedRows
      .filter(
        (row) =>
          typeof row.source_event_id === 'string' && row.source_event_id.length > 0,
      )
      .map((row) => [row.source_event_id as string, row]),
  );

  return items.map((item) => {
    if (item.verb !== 'session.feedback_request.sent') {
      return item;
    }

    const classSessionId = item.metadata?.classSessionId;
    const sourceEventId = item.metadata?.sourceEventId;
    const feedback =
      (typeof classSessionId === 'string'
        ? feedbackBySessionId.get(classSessionId)
        : null) ??
      (typeof sourceEventId === 'string' ? feedbackByEventId.get(sourceEventId) : null);
    if (!feedback) {
      return item;
    }

    return {
      ...item,
      metadata: {
        ...(item.metadata ?? {}),
        feedbackResponse: {
          sourceEventId: feedback.source_event_id ?? null,
          classSessionId: feedback.class_session_id,
          messageId: feedback.message_id ?? null,
          rating: feedback.rating,
          comment: feedback.comment ?? null,
          submittedAt: feedback.submitted_at,
        },
      },
    };
  });
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
