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
  UserProfileVM,
} from '@iconicedu/shared-types';
import { apiGet, apiPost } from '@/lib/api/http-client';
import { buildSenderProfile } from '@/lib/api/map-row-to-vm';
import { supabase } from '@/lib/supabase/client';

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

async function loadActivityFeedActors(
  orgId: string,
  rows: ActivityFeedItemRow[],
): Promise<Map<string, UserProfileVM>> {
  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_profile_id).filter(Boolean)),
  );

  if (!actorIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, first_name, last_name, avatar_url, avatar_seed, kind')
    .eq('org_id', orgId)
    .in('id', actorIds)
    .is('deleted_at', null)
    .returns<RawActivityActorProfile[]>();

  if (error) throw error;

  return new Map(
    (data ?? []).map((profile: RawActivityActorProfile) => [
      profile.id,
      buildSenderProfile(profile, orgId),
    ]),
  );
}

function buildFeedSections(items: ActivityFeedItemVM[]): ActivityFeedSectionVM[] {
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

  const sections: ActivityFeedSectionVM[] = [];
  if (today.length) sections.push({ label: 'Today', items: today });
  if (yesterday.length) sections.push({ label: 'Yesterday', items: yesterday });
  if (thisWeek.length) sections.push({ label: 'This week', items: thisWeek });
  if (older.length) sections.push({ label: 'Earlier', items: older });
  return sections;
}

function buildFeedTabs(items: ActivityFeedItemVM[]): ActivityFeedTabVM[] {
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

export async function fetchActivityFeed(
  orgId: string,
  profileId: string,
): Promise<ActivityFeedVM> {
  return apiGet('/activity-feed', { orgId, profileId });
}

export async function markActivityFeedRead(
  orgId: string,
  profileId: string,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  await apiPost('/activity-feed/read', { orgId, profileId, ids });
}
