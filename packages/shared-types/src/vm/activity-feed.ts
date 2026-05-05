import type { AvatarVM, UserProfileVM } from '@iconicedu/shared-types/vm/profile';
import type {
  EntityRefVM,
  IdsBaseVM,
  ISODateTime,
  ThemeKey,
  UUID,
} from '@iconicedu/shared-types/shared/shared';

export type ActivityVerbVM =
  | 'class.session.rescheduled'
  | 'class.sessions.rescheduled'
  | 'class.session.canceled'
  | 'class.sessions.canceled'
  | 'message.posted'
  | 'messages.posted'
  | 'reaction.added'
  | 'reactions.added'
  | 'session.reminder.sent'
  | 'sessions.reminder.sent'
  | 'session.feedback_request.sent'
  | 'sessions.feedback_request.sent';

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
  | 'CalendarCheck'
  | 'CalendarX'
  | 'CreditCard'
  | 'GraduationCap'
  | 'MessageSquare'
  | 'Bell';

export type InboxLeadingVM =
  | {
      kind: 'icon';
      iconKey: InboxIconKeyVM;
      tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
    }
  | {
      kind: 'avatars';
      avatars: Array<{
        accountId?: UUID | null;
        name: string;
        avatar: AvatarVM;
        profileId?: UUID | null;
        themeKey?: ThemeKey | null;
      }>;
      overflowCount?: number;
    };

export type InboxHeadlineVM = {
  primary: string;
  secondary?: string;
  secondaryHref?: string;
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

  content: ActivityItemContentVM;

  state?: ActivityItemStateVM;

  metadata?: Record<string, unknown>;
}

export type ActivityFeedLeafItemVM = ActivityFeedItemBaseVM & {
  kind: 'leaf';
};

export type ActivityFeedItemVM = ActivityFeedLeafItemVM;

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

export type ActivityVerbSuppressionScopeVM = 'org' | 'actor';

export type ActivityVerbSuppressionRuleVM = {
  id: UUID;
  orgId: UUID;
  eventType: string;
  actorProfileId?: UUID | null;
  scope: ActivityVerbSuppressionScopeVM;
  isEnabled: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ActivityVerbCatalogItemVM = {
  eventType: string;
  isKnown: boolean;
  isReadOnly: boolean;
};

export type ActivityVerbSuppressionProfileOptionVM = {
  profileId: UUID;
  displayName: string;
};

export type ActivityVerbSuppressionSnapshotVM = {
  orgRules: ActivityVerbSuppressionRuleVM[];
  actorRules: ActivityVerbSuppressionRuleVM[];
  verbCatalog: ActivityVerbCatalogItemVM[];
  profiles: ActivityVerbSuppressionProfileOptionVM[];
};
