import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  ActivityFeedTabVM,
  ClassSessionCompletionVoteRow,
  ClassSessionFeedbackRow,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { mapActivityFeedItemRow } from '@iconicedu/web/lib/activity-feed/mappers/activity-feed.mapper';
import {
  getActivityFeedItemsByOrg,
  getClassSessionCompletionVotesByProfileAndTargets,
  getClassSessionFeedbackByProfileAndSessions,
} from '@iconicedu/web/lib/activity-feed/queries/activity-feed.query';
import { buildUserProfileFromRow } from '@iconicedu/web/lib/profile/builders/user-profile.builder';
import { getProfilesByIds } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';

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

type ClassSessionCompletionVoteSummary = Pick<
  ClassSessionCompletionVoteRow,
  | 'schedule_id'
  | 'occurrence_key'
  | 'profile_id'
  | 'role'
  | 'status'
  | 'dispute_category'
  | 'dispute_reason'
  | 'reschedule_requested'
  | 'voted_at'
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

function isNonEmptyString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
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

function occurrenceResponseKey(id: string, occurrenceStart: string | null) {
  return `${id}:${normalizeOccurrenceKey(occurrenceStart)}`;
}

function completionVoteKey(scheduleId: string, occurrenceStart: string) {
  return occurrenceResponseKey(scheduleId, occurrenceStart);
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

function mapCompletionVote(row: ClassSessionCompletionVoteSummary) {
  return {
    scheduleId: row.schedule_id,
    occurrenceKey: normalizeOccurrenceValue(row.occurrence_key),
    profileId: row.profile_id,
    role: row.role,
    status: row.status,
    disputeCategory: row.dispute_category,
    disputeReason: row.dispute_reason,
    rescheduleRequested: row.reschedule_requested,
    votedAt: row.voted_at,
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

    const feedbackOccurrenceStart = getFeedbackOccurrenceStart(item);
    const feedbackResponse =
      feedbackResponses.get(
        occurrenceResponseKey(feedbackClassSessionId, feedbackOccurrenceStart),
      ) ??
      (feedbackOccurrenceStart ? null : feedbackResponses.get(feedbackClassSessionId));
    if (!feedbackResponse) return item;

    return {
      ...item,
      metadata: {
        ...(item.metadata ?? {}),
        feedbackResponse: mapFeedbackResponse(feedbackResponse),
      },
    } as ActivityFeedLeafItemVM;
  });

  const completionVotes = await loadCompletionVotes(orgId, profileId, itemsWithFeedback);
  const hydratedItems = itemsWithFeedback.map((item) => {
    if (
      item.kind !== 'leaf' ||
      (item.verb !== 'session.completion_check.sent' &&
        item.verb !== 'session.completion_check.batch.sent')
    ) {
      return item;
    }

    if (item.verb === 'session.completion_check.sent') {
      const scheduleId = getCompletionScheduleId(item);
      const occurrenceStart = getCompletionOccurrenceStart(item);
      if (!scheduleId || !occurrenceStart) return item;

      const vote = completionVotes.get(completionVoteKey(scheduleId, occurrenceStart));
      if (!vote) return item;

      return {
        ...item,
        metadata: {
          ...(item.metadata ?? {}),
          completionVote: mapCompletionVote(vote),
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

          const vote = completionVotes.get(
            completionVoteKey(scheduleId, occurrenceStart),
          );
          if (!vote) return session;

          return {
            ...sessionRecord,
            completionVote: mapCompletionVote(vote),
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
  const responses = new Map<string, ClassSessionFeedbackSummary>();
  (feedbackResponse.data ?? []).forEach((row) => {
    responses.set(
      occurrenceResponseKey(row.class_session_id, row.occurrence_start_at ?? null),
      row,
    );

    if (!responses.has(row.class_session_id)) {
      responses.set(row.class_session_id, row);
    }
  });

  return responses;
}

function collectCompletionTargets(items: ActivityFeedItemVM[]) {
  const targets = new Map<string, { scheduleId: string; occurrenceStart: string }>();

  items
    .filter((item) => item.kind === 'leaf')
    .filter(
      (item) =>
        item.verb === 'session.completion_check.sent' ||
        item.verb === 'session.completion_check.batch.sent',
    )
    .forEach((item) => {
      if (item.verb === 'session.completion_check.sent') {
        const scheduleId = getCompletionScheduleId(item);
        const occurrenceStart = getCompletionOccurrenceStart(item);
        if (scheduleId && occurrenceStart) {
          targets.set(completionVoteKey(scheduleId, occurrenceStart), {
            scheduleId,
            occurrenceStart,
          });
        }
        return;
      }

      const metadata = asRecord(item.metadata);
      if (!Array.isArray(metadata.sessions)) return;

      metadata.sessions.forEach((session) => {
        const sessionRecord = asRecord(session);
        const scheduleId = sessionRecord.scheduleId;
        const occurrenceStart = sessionRecord.occurrenceStart;
        if (typeof scheduleId === 'string' && typeof occurrenceStart === 'string') {
          targets.set(completionVoteKey(scheduleId, occurrenceStart), {
            scheduleId,
            occurrenceStart,
          });
        }
      });
    });

  return Array.from(targets.values());
}

async function loadCompletionVotes(
  orgId: string,
  profileId: string,
  items: ActivityFeedItemVM[],
) {
  const targets = collectCompletionTargets(items);
  if (!profileId || !targets.length) {
    return new Map<string, ClassSessionCompletionVoteSummary>();
  }

  const scheduleIds = Array.from(new Set(targets.map((target) => target.scheduleId)));
  const occurrenceStarts = Array.from(
    new Set(targets.map((target) => target.occurrenceStart)),
  );
  const serviceSupabase = createSupabaseServiceClient();
  const completionVoteResponse = await getClassSessionCompletionVotesByProfileAndTargets(
    serviceSupabase,
    orgId,
    profileId,
    scheduleIds,
    occurrenceStarts,
  );

  return new Map(
    (completionVoteResponse.data ?? []).map((row) => [
      completionVoteKey(row.schedule_id, row.occurrence_key),
      row,
    ]),
  );
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
