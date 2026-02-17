import type {
  ActivityFeedItemRow,
  ActivityFeedSectionRow,
  ActivityFeedItemVM,
  ActivityFeedSectionVM,
  ActivityActorVM,
  ActivityItemAudienceVM,
  ActivityItemContentVM,
  ActivityItemRefsVM,
  ActivityItemStateVM,
  ActivityVerbVM,
  InboxTabKeyVM,
  ActivityItemGroupingVM,
} from '@iconicedu/shared-types';

export function mapActivityFeedItemRow(
  row: ActivityFeedItemRow,
  options: { actor?: ActivityActorVM | null } = {},
): ActivityFeedItemVM {
  const contentBase = (row.content ?? {}) as Partial<ActivityItemContentVM>;
  const content: ActivityItemContentVM = {
    ...contentBase,
    headline: contentBase.headline ?? {
      primary: row.summary ?? 'Activity update',
    },
    summary: contentBase.summary ?? row.summary ?? undefined,
    preview:
      contentBase.preview ??
      ((row.preview ?? undefined) as ActivityItemContentVM['preview']),
    actionButton:
      contentBase.actionButton ??
      ((row.action_button ?? undefined) as ActivityItemContentVM['actionButton']),
    expandedContent: contentBase.expandedContent ?? row.expanded_content ?? undefined,
  };
  const refsBase = (row.refs ?? {}) as Partial<ActivityItemRefsVM>;
  const refs = {
    ...(refsBase as ActivityItemRefsVM),
    actor: options.actor ?? (refsBase.actor as ActivityActorVM),
  } as ActivityItemRefsVM;
  const audienceBase = (row.audience ?? {}) as Partial<ActivityItemAudienceVM>;
  const audience: ActivityItemAudienceVM = {
    ...audienceBase,
    scope: audienceBase.scope ?? { kind: 'global' },
    visibility: audienceBase.visibility ?? 'public',
  };
  const grouping: ActivityItemGroupingVM | undefined =
    row.group_key || row.group_type
      ? {
          groupKey: row.group_key ?? undefined,
          groupType: row.group_type as ActivityItemGroupingVM['groupType'],
        }
      : (content as Partial<{ grouping: ActivityItemGroupingVM }>).grouping;

  const base = {
    kind: (row.kind ?? 'leaf') as ActivityFeedItemVM['kind'],
    ids: { id: row.id, orgId: row.org_id },
    timestamps: {
      occurredAt: row.occurred_at ?? row.created_at,
      createdAt: row.created_at,
    },
    tabKey: row.tab_key as InboxTabKeyVM,
    audience,
    verb: row.verb as ActivityVerbVM,
    refs,
    content,
    state: {
      importance: row.importance as ActivityItemStateVM['importance'],
      isRead: row.is_read ?? undefined,
    },
  };

  return {
    ...base,
    grouping,
    subActivities: (content as Partial<ActivityFeedItemVM>).subActivities,
    subActivityCount: row.sub_activity_count ?? undefined,
    isCollapsed: row.is_collapsed ?? undefined,
  } as ActivityFeedItemVM;
}

export function mapActivityFeedSectionRow(
  row: ActivityFeedSectionRow,
  items: ActivityFeedItemVM[],
): ActivityFeedSectionVM {
  return {
    label: row.label,
    items,
  };
}
