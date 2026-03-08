import type { AvatarVM, UserProfileVM } from '@iconicedu/shared-types/vm/profile';
import type {
  ConnectionVM,
  EntityRefVM,
  IdsBaseVM,
  ISODateTime,
  ThemeKey,
  UUID,
} from '@iconicedu/shared-types/shared/shared';

export type ActivityGroupKeyVM =
  | 'homework'
  | 'message'
  | 'class'
  | 'reminder'
  | 'recording'
  | 'notes'
  | 'ai-summary'
  | 'payment'
  | 'survey'
  | 'complete-class';

export type ActivityVerbVM =
  | 'class.created'
  | 'classes.created'
  | 'class.updated'
  | 'classes.updated'
  | 'class.archived'
  | 'classes.archived'
  | 'session.scheduled'
  | 'sessions.scheduled'
  | 'session.rescheduled'
  | 'sessions.rescheduled'
  | 'session.canceled'
  | 'sessions.canceled'
  | 'session.started'
  | 'sessions.started'
  | 'session.ended'
  | 'sessions.ended'
  | 'session.completed'
  | 'sessions.completed'
  | 'message.posted'
  | 'messages.posted'
  | 'message.edited'
  | 'messages.edited'
  | 'message.deleted'
  | 'messages.deleted'
  | 'reaction.added'
  | 'reactions.added'
  | 'reaction.removed'
  | 'reactions.removed'
  | 'homework.assigned'
  | 'homeworks.assigned'
  | 'homework.submitted'
  | 'homeworks.submitted'
  | 'homework.reviewed'
  | 'homeworks.reviewed'
  | 'summary.posted'
  | 'summaries.posted'
  | 'notes.posted'
  | 'file.uploaded'
  | 'files.uploaded'
  | 'file.deleted'
  | 'files.deleted'
  | 'member.invited'
  | 'members.invited'
  | 'members.joined'
  | 'members.removed'
  | 'member.joined'
  | 'member.removed'
  | 'role.changed'
  | 'roles.changed'
  | 'payment.reminder'
  | 'payments.reminder'
  | 'payment.reminder.sent'
  | 'payments.reminder.sent'
  | 'payment.received'
  | 'payments.received'
  | 'payment.failed'
  | 'payments.failed'
  | 'session.reminder.sent'
  | 'sessions.reminder.sent'
  | 'session.feedback_request.sent'
  | 'sessions.feedback_request.sent'
  | 'system.notice'
  | 'systems.notice';

export type ActivitySourceKindVM =
  | 'profile'
  | 'system'
  | 'integration'
  | 'provider_webhook';

export type ActivityVisibilityVM = 'public' | 'scope_only' | 'direct';
export type ActivityImportanceVM = 'normal' | 'important' | 'urgent';

export type FeedScopeVM =
  | { kind: 'global' }
  | { kind: 'learning_space'; learningSpaceId: UUID }
  | { kind: 'channel'; channelId: UUID }
  | { kind: 'dm'; threadId: UUID }
  | { kind: 'user'; userId: UUID };

export type AudienceRuleVM =
  | { kind: 'all_in_scope' }
  | { kind: 'roles_only'; roleKeys: string[] }
  | { kind: 'users_only'; userIds: UUID[] }
  | { kind: 'exclude_users'; userIds: UUID[] };

export type ActivityActorVM = UserProfileVM;

export type InboxTabKeyVM = 'all' | 'classes' | 'payment' | 'system';

export type InboxIconKeyVM =
  | 'Bell'
  | 'CalendarDays'
  | 'CheckCircle2'
  | 'ClipboardCheck'
  | 'CreditCard'
  | 'FileText'
  | 'GraduationCap'
  | 'MessageSquare'
  | 'Paperclip'
  | 'Sparkles'
  | 'Video';

export type InboxLeadingVM =
  | {
      kind: 'icon';
      iconKey: InboxIconKeyVM;
      tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
    }
  | {
      kind: 'avatars';
      avatars: Array<{
        name: string;
        avatar: AvatarVM;
        themeKey?: ThemeKey | null;
      }>;
      overflowCount?: number;
    };

export type InboxHeadlineVM = {
  primary: string;
  secondary?: string;
  emphasis?: string;
};

export type InboxActionButtonVM = {
  label: string;
  variant: 'default' | 'outline' | 'secondary';
  href?: string | null;
  actionKey?: string | null;
  payload?: Record<string, unknown> | null;
};

export interface ActivityItemTimestampsVM {
  occurredAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface ActivityItemAudienceVM {
  scope: FeedScopeVM;
  visibility: ActivityVisibilityVM;
  audience?: AudienceRuleVM[];
}

export interface ActivityItemRefsVM {
  actor: ActivityActorVM;
  object?: EntityRefVM;
  target?: EntityRefVM;
}

export interface ActivityItemGroupingVM {
  groupKey?: string;
  groupType?: ActivityGroupKeyVM;
}

export interface ActivityItemContentVM {
  leading?: InboxLeadingVM;
  headline: InboxHeadlineVM;
  summary?: string;

  preview?: {
    text?: string;
    attachmentsCount?: number;
  };

  actionButton?: InboxActionButtonVM;
  expandedContent?: string;
}

export interface ActivityItemStateVM {
  importance?: ActivityImportanceVM;
  isRead?: boolean;
}

export interface ActivityFeedItemBaseVM {
  ids: IdsBaseVM;

  timestamps: ActivityItemTimestampsVM;

  tabKey: InboxTabKeyVM;

  audience: ActivityItemAudienceVM;

  verb: ActivityVerbVM;

  refs: ActivityItemRefsVM;

  grouping?: ActivityItemGroupingVM;

  content: ActivityItemContentVM;

  state?: ActivityItemStateVM;

  metadata?: Record<string, unknown>;
}

export type ActivityFeedLeafItemVM = ActivityFeedItemBaseVM & {
  kind: 'leaf';

  grouping?: {
    groupKey?: never;
    groupType?: never;
  };

  subActivities?: never;
};

export type ActivityFeedGroupItemVM = ActivityFeedItemBaseVM & {
  kind: 'group';

  grouping: {
    groupType: ActivityGroupKeyVM;
    groupKey: string;
  };

  isCollapsed?: boolean;
  subActivityCount?: number;

  subActivities?: ConnectionVM<ActivityFeedLeafItemVM>;
};

export type ActivityFeedItemVM = ActivityFeedLeafItemVM | ActivityFeedGroupItemVM;

export type ActivityFeedSectionVM = {
  label: string;
  items: ActivityFeedItemVM[];
};

export type ActivityFeedTabVM = {
  key: InboxTabKeyVM;
  label: string;
  badgeCount?: number;
};

export type ActivityFeedVM = {
  activeTab: InboxTabKeyVM;
  tabs: ActivityFeedTabVM[];

  sections: ActivityFeedSectionVM[];

  nextCursor?: string | null;
  unreadCount?: number;
};
