import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
  SessionCompletionVM,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapActivityFeedItemRow } from '@iconicedu/web/lib/activity-feed/mappers/activity-feed.mapper';
import { getActivityFeedItemsByOrg } from '@iconicedu/web/lib/activity-feed/queries/activity-feed.query';
import { buildUserProfileFromRow } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { listSessionCompletions } from '@iconicedu/web/lib/api/session-completions';

const FEED_TABS: Array<{ key: InboxTabKeyVM; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'classes', label: 'Classes' },
  { key: 'payment', label: 'Payment' },
  { key: 'system', label: 'System' },
];

type BuildActivityFeedOptions = {
  activeTab?: InboxTabKeyVM;
};

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

function getFeedbackOccurrenceStart(item: ActivityFeedItemVM) {
  const metadata = asRecord(item.metadata);
  if (typeof metadata.occurrenceStart === 'string') return metadata.occurrenceStart;
  if (typeof metadata.startAt === 'string') return metadata.startAt;
  return null;
}

function getCompletionScheduleId(item: ActivityFeedItemVM) {
  const metadata = asRecord(item.metadata);
  return typeof metadata.scheduleId === 'string' ? metadata.scheduleId : null;
}

function getCompletionOccurrenceStart(item: ActivityFeedItemVM) {
  const metadata = asRecord(item.metadata);
  return typeof metadata.occurrenceStart === 'string' ? metadata.occurrenceStart : null;
}

function normalizeOccurrenceKey(value: string | null) {
  if (!value) return 'none';
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
}

function normalizeOccurrenceValue(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
}

function sessionCompletionKey(id: string, occurrenceStart: string | null) {
  return `${id}:${normalizeOccurrenceKey(occurrenceStart)}`;
}

function sessionCompletionIdKey(id: string) {
  return `id:${id}`;
}

function mapSessionCompletion(row: SessionCompletionVM) {
  return { ...row, occurrenceKey: normalizeOccurrenceValue(row.occurrenceKey) };
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
  const sessionCompletions = await loadSessionCompletions(
    supabase,
    orgId,
    profileId,
    mappedItems,
  );
  const hydratedItems = mappedItems.map((item) => {
    if (
      item.kind !== 'leaf' ||
      (item.verb !== 'session.feedback_request.sent' &&
        item.verb !== 'session.completion_check.sent' &&
        item.verb !== 'session.completion_check.batch.sent')
    ) {
      return item;
    }

    if (item.verb !== 'session.completion_check.batch.sent') {
      const metadata = asRecord(item.metadata);
      const completionId =
        typeof metadata.sessionCompletionId === 'string'
          ? metadata.sessionCompletionId
          : null;
      const scheduleId =
        item.verb === 'session.feedback_request.sent'
          ? getFeedbackClassSessionId(item)
          : getCompletionScheduleId(item);
      const occurrenceStart =
        item.verb === 'session.feedback_request.sent'
          ? getFeedbackOccurrenceStart(item)
          : getCompletionOccurrenceStart(item);
      const completion =
        (completionId
          ? sessionCompletions.get(sessionCompletionIdKey(completionId))
          : null) ??
        (scheduleId && occurrenceStart
          ? sessionCompletions.get(sessionCompletionKey(scheduleId, occurrenceStart))
          : null) ??
        (scheduleId ? sessionCompletions.get(scheduleId) : null);
      if (!completion) return item;

      return {
        ...item,
        metadata: {
          ...(item.metadata ?? {}),
          sessionCompletion: mapSessionCompletion(completion),
        },
      } as ActivityFeedLeafItemVM;
    }

    const metadata = asRecord(item.metadata);
    if (!Array.isArray(metadata.sessions)) return item;

    return {
      ...item,
      metadata: {
        ...(item.metadata ?? {}),
        sessions: metadata.sessions.map((session) => {
          const sessionRecord = asRecord(session);
          const scheduleId = sessionRecord.scheduleId;
          const occurrenceStart = sessionRecord.occurrenceStart;
          if (typeof scheduleId !== 'string' || typeof occurrenceStart !== 'string') {
            return session;
          }

          const completionId =
            typeof sessionRecord.sessionCompletionId === 'string'
              ? sessionRecord.sessionCompletionId
              : null;
          const completion =
            (completionId
              ? sessionCompletions.get(sessionCompletionIdKey(completionId))
              : null) ??
            sessionCompletions.get(sessionCompletionKey(scheduleId, occurrenceStart));
          if (!completion) return session;

          return {
            ...sessionRecord,
            sessionCompletion: mapSessionCompletion(completion),
          };
        }),
      },
    } as ActivityFeedLeafItemVM;
  });

  const filteredItems =
    activeTab === 'all'
      ? hydratedItems
      : hydratedItems.filter((item) => item.tabKey === activeTab);

  const sections = buildActivitySections(filteredItems);
  const tabs = buildFeedTabs(hydratedItems);
  const unreadCount = countUnreadItems(hydratedItems);

  return {
    activeTab,
    tabs,
    sections,
    nextCursor: null,
    unreadCount,
  };
}

async function loadSessionCompletions(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
  items: ActivityFeedItemVM[],
) {
  const hasSessionCompletionItems = items.some(
    (item) =>
      item.kind === 'leaf' &&
      (item.verb === 'session.feedback_request.sent' ||
        item.verb === 'session.completion_check.sent' ||
        item.verb === 'session.completion_check.batch.sent'),
  );
  if (!profileId || !hasSessionCompletionItems) {
    return new Map<string, SessionCompletionVM>();
  }

  const response = await listSessionCompletions(supabase, {
    orgId,
    profileId,
    limit: 50,
  });
  const completions = new Map<string, SessionCompletionVM>();
  response.items.forEach((row) => {
    completions.set(sessionCompletionIdKey(row.id), row);
    completions.set(sessionCompletionKey(row.scheduleId, row.occurrenceKey), row);
    if (!completions.has(row.scheduleId)) {
      completions.set(row.scheduleId, row);
    }
  });
  return completions;
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
