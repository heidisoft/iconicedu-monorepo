import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type {
  ActivityFeedVM,
  ActivityFeedItemVM,
  ActivityFeedSectionVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
  ActivityVerbVM,
  ActivityItemContentVM,
  ActivityItemAudienceVM,
  ActivityItemRefsVM,
  ActivityItemStateVM,
  ActivityFeedItemRow,
  ActivityFeedLeafItemVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { buildSenderProfile } from '@iconicedu/api/lib/mobile-data/message-mappers';

const ACTIVITY_FEED_ITEM_SELECT = [
  'id',
  'org_id',
  'recipient_profile_id',
  'source_event_id',
  'kind',
  'occurred_at',
  'created_at',
  'tab_key',
  'audience',
  'verb',
  'actor_profile_id',
  'refs',
  'content',
  'summary',
  'preview',
  'action_button',
  'expanded_content',
  'importance',
  'is_read',
  'read_at',
  'dedupe_key',
  'metadata',
  'updated_at',
  'deleted_at',
].join(',');

const FEED_TABS: Array<{ key: InboxTabKeyVM; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'classes', label: 'Classes' },
  { key: 'payment', label: 'Payment' },
  { key: 'system', label: 'System' },
];

type RawActivityActorProfile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  kind?: string | null;
};

type RawClassSessionFeedbackRow = {
  source_event_id: string | null;
  message_id: string | null;
  class_session_id: string;
  classroom_id: string;
  channel_id: string;
  occurrence_start_at: string | null;
  rating: number;
  comment: string | null;
  submitted_at: string;
};

type RawClassSessionCompletionVoteRow = {
  schedule_id: string;
  occurrence_key: string;
  profile_id: string;
  role: string;
  status: 'confirmed' | 'disputed';
  dispute_category: string | null;
  dispute_reason: string | null;
  reschedule_requested: boolean;
  voted_at: string;
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

function completionVoteKey(scheduleId: string, occurrenceStart: string) {
  return `${scheduleId}:${occurrenceStart}`;
}

function mapFeedbackResponse(row: RawClassSessionFeedbackRow) {
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

function mapCompletionVote(row: RawClassSessionCompletionVoteRow) {
  return {
    scheduleId: row.schedule_id,
    occurrenceKey: row.occurrence_key,
    profileId: row.profile_id,
    role: row.role,
    status: row.status,
    disputeCategory: row.dispute_category,
    disputeReason: row.dispute_reason,
    rescheduleRequested: row.reschedule_requested,
    votedAt: row.voted_at,
  };
}

function mapFeedRow(row: ActivityFeedItemRow): ActivityFeedItemVM {
  const contentBase = (row.content ?? {}) as Partial<ActivityItemContentVM>;
  const content: ActivityItemContentVM = {
    ...contentBase,
    headline: contentBase.headline ?? { primary: row.summary ?? 'Activity update' },
    summary: contentBase.summary ?? row.summary ?? undefined,
    preview:
      contentBase.preview ??
      (row.preview as ActivityItemContentVM['preview']) ??
      undefined,
    actionButton:
      contentBase.actionButton ??
      (row.action_button as ActivityItemContentVM['actionButton']) ??
      undefined,
    expandedContent: contentBase.expandedContent ?? row.expanded_content ?? undefined,
  };

  const refsBase = (row.refs ?? {}) as Partial<ActivityItemRefsVM>;
  const audienceBase = (row.audience ?? {}) as Partial<ActivityItemAudienceVM>;

  const state: ActivityItemStateVM = {
    importance: row.importance as ActivityItemStateVM['importance'],
    isRead: row.is_read ?? undefined,
  };

  return {
    kind: 'leaf',
    ids: { id: row.id, orgId: row.org_id },
    timestamps: {
      occurredAt: row.occurred_at ?? row.created_at,
      createdAt: row.created_at,
    },
    tabKey: row.tab_key as InboxTabKeyVM,
    audience: {
      ...audienceBase,
      scope: audienceBase.scope ?? { kind: 'global' },
      visibility: audienceBase.visibility ?? 'public',
    },
    verb: row.verb as ActivityVerbVM,
    refs: { ...refsBase } as ActivityItemRefsVM,
    content,
    state,
    metadata: {
      ...(row.metadata ?? {}),
      ...(row.source_event_id ? { sourceEventId: row.source_event_id } : {}),
    },
  } as ActivityFeedItemVM;
}

@Injectable()
export class ActivityFeedQueryService {
  private collectCompletionTargets(items: ActivityFeedItemVM[]) {
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

  private async loadFeedbackResponses(
    accessToken: string,
    orgId: string,
    profileId: string,
    items: ActivityFeedItemVM[],
  ): Promise<Map<string, RawClassSessionFeedbackRow>> {
    const feedbackClassSessionIds = Array.from(
      new Set(
        items
          .filter((item) => item.kind === 'leaf')
          .filter((item) => item.verb === 'session.feedback_request.sent')
          .map(getFeedbackClassSessionId)
          .filter(isNonEmptyString),
      ),
    );
    if (!feedbackClassSessionIds.length) return new Map();

    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('class_session_feedback')
      .select(
        'source_event_id, message_id, class_session_id, classroom_id, channel_id, occurrence_start_at, rating, comment, submitted_at',
      )
      .eq('org_id', orgId)
      .eq('recipient_profile_id', profileId)
      .is('deleted_at', null)
      .in('class_session_id', feedbackClassSessionIds)
      .returns<RawClassSessionFeedbackRow[]>();
    if (error) throw new InternalServerErrorException(error.message);

    return new Map((data ?? []).map((row) => [row.class_session_id, row]));
  }

  private async loadCompletionVotes(
    accessToken: string,
    orgId: string,
    profileId: string,
    items: ActivityFeedItemVM[],
  ): Promise<Map<string, RawClassSessionCompletionVoteRow>> {
    const targets = this.collectCompletionTargets(items);
    if (!targets.length) return new Map();

    const scheduleIds = Array.from(new Set(targets.map((target) => target.scheduleId)));
    const occurrenceStarts = Array.from(
      new Set(targets.map((target) => target.occurrenceStart)),
    );

    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('class_session_completion_votes')
      .select(
        'schedule_id, occurrence_key, profile_id, role, status, dispute_category, dispute_reason, reschedule_requested, voted_at',
      )
      .eq('org_id', orgId)
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .in('schedule_id', scheduleIds)
      .in('occurrence_key', occurrenceStarts)
      .returns<RawClassSessionCompletionVoteRow[]>();
    if (error) throw new InternalServerErrorException(error.message);

    return new Map(
      (data ?? []).map((row) => [
        completionVoteKey(row.schedule_id, row.occurrence_key),
        row,
      ]),
    );
  }

  private async loadActivityFeedActors(
    accessToken: string,
    orgId: string,
    rows: ActivityFeedItemRow[],
  ): Promise<Map<string, UserProfileVM>> {
    const actorIds = Array.from(
      new Set(rows.map((row) => row.actor_profile_id).filter(Boolean)),
    );
    if (!actorIds.length) return new Map();

    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name, avatar_url, avatar_seed, kind')
      .eq('org_id', orgId)
      .in('id', actorIds)
      .is('deleted_at', null)
      .returns<RawActivityActorProfile[]>();
    if (error) throw new InternalServerErrorException(error.message);

    return new Map(
      (data ?? []).map((profile) => [profile.id, buildSenderProfile(profile, orgId)]),
    );
  }

  private buildFeedSections(items: ActivityFeedItemVM[]): ActivityFeedSectionVM[] {
    if (!items.length) return [];
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
      } else if (occurredAt >= startOfYesterday) {
        yesterday.push(item);
      } else if (occurredAt >= startOfWeek) {
        thisWeek.push(item);
      } else {
        older.push(item);
      }
    });

    const sections: ActivityFeedSectionVM[] = [];
    if (today.length) sections.push({ label: 'Today', items: today });
    if (yesterday.length) sections.push({ label: 'Yesterday', items: yesterday });
    if (thisWeek.length) sections.push({ label: 'This week', items: thisWeek });
    if (older.length) sections.push({ label: 'Earlier', items: older });
    return sections;
  }

  private buildFeedTabs(items: ActivityFeedItemVM[]): ActivityFeedTabVM[] {
    const counts = new Map<InboxTabKeyVM, number>();
    items.forEach((item) => {
      if (item.state?.isRead) return;
      counts.set(item.tabKey, (counts.get(item.tabKey) ?? 0) + 1);
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

  async fetchFeed(
    accessToken: string,
    orgId: string,
    profileId: string,
  ): Promise<ActivityFeedVM> {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data: itemRows, error: itemsError } = await supabase
      .from('activity_feed_items')
      .select(ACTIVITY_FEED_ITEM_SELECT)
      .eq('org_id', orgId)
      .eq('recipient_profile_id', profileId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .returns<ActivityFeedItemRow[]>();
    if (itemsError) throw new InternalServerErrorException(itemsError.message);

    const rows = itemRows ?? [];
    const actorProfiles = await this.loadActivityFeedActors(accessToken, orgId, rows);

    const mappedItems = rows.map((row) => {
      const item = mapFeedRow(row);
      const hydratedActor = row.actor_profile_id
        ? actorProfiles.get(row.actor_profile_id)
        : null;
      if (!hydratedActor) return item;
      return {
        ...item,
        refs: { ...item.refs, actor: hydratedActor },
      } as ActivityFeedItemVM;
    });

    const feedbackResponses = await this.loadFeedbackResponses(
      accessToken,
      orgId,
      profileId,
      mappedItems,
    );
    const feedbackItems = mappedItems.map((item) => {
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
    const completionVotes = await this.loadCompletionVotes(
      accessToken,
      orgId,
      profileId,
      feedbackItems,
    );
    const hydratedItems = feedbackItems.map((item) => {
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

    const sections = this.buildFeedSections(hydratedItems);
    const tabs = this.buildFeedTabs(hydratedItems);
    const unreadCount = hydratedItems.filter((item) => !item.state?.isRead).length;

    return {
      activeTab: 'all',
      tabs,
      sections,
      nextCursor: null,
      unreadCount,
    };
  }

  async markRead(accessToken: string, orgId: string, profileId: string, ids: string[]) {
    if (!ids.length) return { success: true };
    const supabase = createSupabaseSessionClient(accessToken);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('activity_feed_items')
      .update({
        is_read: true,
        read_at: now,
        updated_at: now,
        updated_by: profileId,
      })
      .eq('org_id', orgId)
      .eq('recipient_profile_id', profileId)
      .in('id', ids);
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
