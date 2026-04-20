import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type {
  ActivityFeedVM,
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedSectionVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
  ActivityVerbVM,
  ActivityItemContentVM,
  ActivityItemAudienceVM,
  ActivityItemRefsVM,
  ActivityItemStateVM,
  ActivityItemGroupingVM,
  ActivityFeedItemRow,
  ActivityFeedGroupMemberRow,
  ClassSessionFeedbackRow,
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
  'group_key',
  'group_type',
  'is_collapsed',
  'sub_activity_count',
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

const ACTIVITY_FEED_GROUP_MEMBER_SELECT =
  'id,org_id,group_id,item_id,updated_at,deleted_at';

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
  const grouping: ActivityItemGroupingVM | undefined =
    row.group_key || row.group_type
      ? {
          groupKey: row.group_key ?? undefined,
          groupType: row.group_type as ActivityItemGroupingVM['groupType'],
        }
      : undefined;

  const state: ActivityItemStateVM = {
    importance: row.importance as ActivityItemStateVM['importance'],
    isRead: row.is_read ?? undefined,
  };

  return {
    kind: (row.kind ?? 'leaf') as ActivityFeedItemVM['kind'],
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
    grouping,
    subActivityCount: row.sub_activity_count ?? undefined,
    isCollapsed: row.is_collapsed ?? undefined,
    metadata: row.metadata ?? undefined,
  } as ActivityFeedItemVM;
}

@Injectable()
export class ActivityFeedQueryService {
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

  private attachFeedGroupMembers(
    items: ActivityFeedItemVM[],
    groupMembers: ActivityFeedGroupMemberRow[],
  ): ActivityFeedItemVM[] {
    if (!groupMembers.length) return items;

    const itemMap = new Map(items.map((item) => [item.ids.id, item]));
    const membersByGroup = new Map<string, string[]>();
    groupMembers.forEach((member) => {
      const list = membersByGroup.get(member.group_id) ?? [];
      list.push(member.item_id);
      membersByGroup.set(member.group_id, list);
    });

    const groupedMemberIds = new Set<string>();
    const withGroups = items.map((item) => {
      if (item.kind !== 'group') return item;
      const memberIds = membersByGroup.get(item.ids.id) ?? [];
      const members = memberIds
        .map((id) => itemMap.get(id))
        .filter(
          (member): member is ActivityFeedLeafItemVM =>
            !!member && member.kind === 'leaf',
        );
      memberIds.forEach((id) => groupedMemberIds.add(id));

      return {
        ...item,
        subActivities: { items: members },
        subActivityCount: item.subActivityCount ?? members.length,
      } as ActivityFeedItemVM;
    });

    return withGroups.filter(
      (item) => item.kind === 'group' || !groupedMemberIds.has(item.ids.id),
    );
  }

  private async attachFeedbackResponses(
    accessToken: string,
    orgId: string,
    profileId: string,
    items: ActivityFeedItemVM[],
  ): Promise<ActivityFeedItemVM[]> {
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

    const feedbackSelect =
      'class_session_id, source_event_id, message_id, rating, comment, submitted_at';
    const supabase = createSupabaseSessionClient(accessToken);
    const [sessionResponse, eventResponse] = await Promise.all([
      uniqueSessionIds.length
        ? supabase
            .from('class_session_feedback')
            .select(feedbackSelect)
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
            .select(feedbackSelect)
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
    if (sessionResponse.error)
      throw new InternalServerErrorException(sessionResponse.error.message);
    if (eventResponse.error)
      throw new InternalServerErrorException(eventResponse.error.message);

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
      if (item.verb !== 'session.feedback_request.sent') return item;
      const classSessionId = item.metadata?.classSessionId;
      const sourceEventId = item.metadata?.sourceEventId;
      const feedback =
        (typeof classSessionId === 'string'
          ? feedbackBySessionId.get(classSessionId)
          : null) ??
        (typeof sourceEventId === 'string' ? feedbackByEventId.get(sourceEventId) : null);
      if (!feedback) return item;

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
      const unread =
        item.kind === 'group'
          ? ((
              item as { subActivities?: { items: ActivityFeedLeafItemVM[] } }
            ).subActivities?.items.filter((sub) => !sub.state?.isRead).length ??
            (!item.state?.isRead ? 1 : 0))
          : !item.state?.isRead
            ? 1
            : 0;
      if (!unread) return;
      counts.set(item.tabKey, (counts.get(item.tabKey) ?? 0) + unread);
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
    const groupIds = rows.filter((row) => row.kind === 'group').map((row) => row.id);

    let groupMembers: ActivityFeedGroupMemberRow[] = [];
    if (groupIds.length) {
      const { data: members, error: membersError } = await supabase
        .from('activity_feed_group_members')
        .select(ACTIVITY_FEED_GROUP_MEMBER_SELECT)
        .eq('org_id', orgId)
        .in('group_id', groupIds)
        .is('deleted_at', null)
        .returns<ActivityFeedGroupMemberRow[]>();
      if (membersError) throw new InternalServerErrorException(membersError.message);
      groupMembers = members ?? [];
    }

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

    const feedbackItems = await this.attachFeedbackResponses(
      accessToken,
      orgId,
      profileId,
      mappedItems,
    );
    const groupedItems = this.attachFeedGroupMembers(feedbackItems, groupMembers);
    const sections = this.buildFeedSections(groupedItems);
    const tabs = this.buildFeedTabs(feedbackItems);
    const unreadCount = feedbackItems.filter((item) => !item.state?.isRead).length;

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
    const { data: members, error: membersError } = await supabase
      .from('activity_feed_group_members')
      .select('item_id')
      .eq('org_id', orgId)
      .in('group_id', ids);
    if (membersError) throw new InternalServerErrorException(membersError.message);

    const childIds = (members ?? []).map((member) => member.item_id as string);
    const allIds = [...new Set([...ids, ...childIds])];
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
      .in('id', allIds);
    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
