import type { AvatarVM, UserProfileVM } from '@iconicedu/shared-types/vm/profile';
import type {
  EntityRefVM,
  IdsBaseVM,
  ISODateTime,
  ThemeKey,
  UUID,
} from '@iconicedu/shared-types/shared/shared';

export type ActivityVerbVM =
  | 'message.posted'
  | 'message.mentioned'
  | 'message.unviewed_intended_participants'
  | 'message.thread_reply.posted'
  | 'file.uploaded'
  | 'image.uploaded'
  | 'audio.uploaded'
  | 'reaction.added'
  | 'class.schedule.created'
  | 'class.schedule.ended'
  | 'class.session.rescheduled'
  | 'class.session.canceled'
  | 'session.reminder.sent'
  | 'session.feedback_request.sent'
  | 'session.completion_check.sent'
  | 'session.completion_check.batch.sent'
  | 'session.completion.dispute_reported';

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
  | 'AtSign'
  | 'BookImage'
  | 'CalendarCheck'
  | 'CalendarX'
  | 'CreditCard'
  | 'FileBadge'
  | 'FileHeadphone'
  | 'GraduationCap'
  | 'MessageSquare'
  | 'MessageSquareDot'
  | 'MessageSquareHeart'
  | 'MessageSquareReply'
  | 'MessagesSquare'
  | 'SmilePlus'
  | 'Star'
  | 'Bell'
  | 'CheckCircle2'
  | 'AlertCircle';

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
  actor?: ActivityActorVM | null;
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

export interface AdminActivityFeedActorVM {
  profileId: string;
  displayName: string;
  kind?: string | null;
}

export interface AdminActivityFeedChannelVM {
  channelId: string;
  label: string;
  kind?: string | null;
}

export interface AdminActivityFeedDeliveryChannelVM {
  channel: 'push' | 'email' | 'sms' | string;
  status: string;
  createdAt: string;
  lastError?: string | null;
}

export interface AdminActivityFeedPipelineJobVM {
  id: string;
  kind: string;
  status: string;
  attemptCount: number;
  runAt: string;
  createdAt: string;
  nextAttemptAt?: string | null;
  lastError?: string | null;
}

export interface AdminActivityFeedReminderJobVM {
  id: string;
  jobType: string;
  status: string;
  targetKind: string;
  targetId: string;
  runAt: string;
  occurrenceStartAt?: string | null;
  reminderOffsetMinutes?: number | null;
  attemptCount: number;
  dispatchedAt?: string | null;
  lastError?: string | null;
  dispatchResult?: string | null;
}

export interface AdminActivityFeedItemVM {
  id: string;
  sourceEventId?: string | null;
  verb: string;
  tabKey: string;
  summary: string;
  recipient: AdminActivityFeedActorVM;
  actor?: AdminActivityFeedActorVM | null;
  channel?: AdminActivityFeedChannelVM | null;
  scopeLabel: string;
  importance?: string | null;
  isRead: boolean;
  occurredAt: string;
  createdAt: string;
  dedupeKey?: string | null;
  deliveryChannels: AdminActivityFeedDeliveryChannelVM[];
  pipelineJobs: AdminActivityFeedPipelineJobVM[];
  reminderJobs: AdminActivityFeedReminderJobVM[];
}

export interface AdminActivityFeedVerbSummaryVM {
  verb: string;
  count: number;
  unreadCount: number;
  recipientCount: number;
  channelCount: number;
  latestOccurredAt: string;
}

export interface AdminActivityFeedAuditVM {
  generatedAt: string;
  totalCount: number;
  unreadCount: number;
  pipelineJobCount: number;
  reminderJobCount: number;
  verbSummaries: AdminActivityFeedVerbSummaryVM[];
  items: AdminActivityFeedItemVM[];
}

/**
 * Background job kinds surfaced on the admin activity pages. Each value doubles
 * as the URL slug for its dedicated page (`/admin/activity/<kind>`).
 *
 * The first five are `event_pipeline_jobs` rows filtered by `job_kind`; the last
 * two are `reminder_jobs` rows filtered by `job_type`.
 */
export const ADMIN_JOB_ACTIVITY_KINDS = [
  'activity-generate',
  'activity-project',
  'notification-prepare',
  'notification-deliver',
  'reminder-reconcile',
  'session-reminder',
  'session-completion-check',
] as const;

export type AdminJobActivityKind = (typeof ADMIN_JOB_ACTIVITY_KINDS)[number];

export interface AdminJobActivityRecordVM {
  id: string;
  status: string;
  /** Human label for what the job is about — class name, "Push to Jane", etc. */
  label: string;
  /** The message text that was sent, when the job carries one. */
  message: string | null;
  /** Who the job is for/about — "Denise R · educator", "Scott S · child". */
  participants: string[];
  /** The class/occurrence time the job relates to. */
  occurrenceAt: string | null;
  /** Delivery priority when known — "high", "immediate", "delayed". */
  priority: string | null;
  /** Dedupe key / correlation id, for support lookups. */
  detail: string | null;
  attemptCount: number | null;
  maxAttempts: number | null;
  lastError: string | null;
  runAt: string | null;
  dispatchedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AdminJobActivityStatusCountVM {
  status: string;
  count: number;
}

export interface AdminJobActivityGroupVM {
  kind: AdminJobActivityKind;
  title: string;
  description: string;
  /** Edge function that leases and processes this queue. */
  workerName: string;
  /** Number of records in the returned sample (at most the requested limit). */
  sampledCount: number;
  statusCounts: AdminJobActivityStatusCountVM[];
  latestProcessedAt: string | null;
  /** Most recent records first, capped at the requested limit (default 50). */
  records: AdminJobActivityRecordVM[];
  /**
   * Set when this queue could not be read (table missing from the Data API,
   * timeout, permission). Other groups in the response are still valid.
   */
  unavailable: boolean;
  /** Short reason when `unavailable` is true. */
  unavailableReason: string | null;
}

export interface AdminJobActivityOverviewVM {
  generatedAt: string;
  groups: AdminJobActivityGroupVM[];
}
