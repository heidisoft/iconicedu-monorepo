import type {
  AudienceRuleVM,
  FeedScopeVM,
  ActivitySourceKindVM,
  ActivityVerbVM,
} from '@iconicedu/shared-types/vm/activity-feed';
import type {
  EntityRefVM,
  ISODateTime,
  UUID,
} from '@iconicedu/shared-types/shared/shared';

export type ActivityEventTypeVM = ActivityVerbVM;

export interface ActivityEventIdsVM {
  id: UUID;
  orgId: UUID;
}

export interface ActivityEventBaseVM<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  ids: ActivityEventIdsVM;
  eventType: ActivityEventTypeVM;
  occurredAt: ISODateTime;
  sourceKind: ActivitySourceKindVM;
  actorProfileId?: UUID | null;
  scope: FeedScopeVM;
  objectRef?: EntityRefVM | null;
  targetRef?: EntityRefVM | null;
  audienceRules?: AudienceRuleVM[];
  dedupeKey?: string | null;
  payload: TPayload;
}

export interface ClassActivityEventPayload {
  learningSpaceId: UUID;
  channelId?: UUID | null;
  title: string;
  kind?: string | null;
  subject?: string | null;
  status?: string | null;
}

export interface MemberActivityEventPayload {
  learningSpaceId?: UUID | null;
  channelId?: UUID | null;
  memberProfileId?: UUID | null;
  memberDisplayName?: string | null;
  memberAvatarUrl?: string | null;
  memberThemeKey?: string | null;
  memberCount?: number | null;
  members?: Array<{
    profileId: UUID;
    displayName?: string | null;
    avatarUrl?: string | null;
    themeKey?: string | null;
    role?: string | null;
  }> | null;
  role?: string | null;
}

export interface ScheduleActivityEventPayload {
  learningSpaceId?: UUID | null;
  channelId?: UUID | null;
  scheduleId: UUID;
  title: string;
  startAt: ISODateTime;
  endAt?: ISODateTime | null;
}

export interface LiveSessionActivityEventPayload {
  liveSessionId: UUID;
  channelId: UUID;
  learningSpaceId?: UUID | null;
  title: string;
  joinPath?: string | null;
  startedAt?: ISODateTime | null;
  endedAt?: ISODateTime | null;
}

export interface PaymentActivityEventPayload {
  invoiceId?: string | null;
  paymentId?: string | null;
  amount?: number | null;
  currency?: string | null;
  description?: string | null;
  href?: string | null;
}

export interface SessionReminderSentActivityEventPayload {
  channelId: UUID;
  messageId: UUID;
  learningSpaceId?: UUID | null;
  scheduleId?: UUID | null;
  occurrenceStart: ISODateTime;
  title: string;
  summary?: string | null;
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
  members?: Array<{
    profileId: UUID;
    displayName?: string | null;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }> | null;
}

export interface SessionFeedbackRequestSentActivityEventPayload {
  channelId: UUID;
  messageId: UUID;
  learningSpaceId?: UUID | null;
  scheduleId?: UUID | null;
  occurrenceStart: ISODateTime;
  title: string;
  summary?: string | null;
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
  members?: Array<{
    profileId: UUID;
    displayName?: string | null;
    avatarUrl?: string | null;
    themeKey?: string | null;
  }> | null;
}

export interface PaymentReminderSentActivityEventPayload {
  channelId: UUID;
  messageId: UUID;
  learningSpaceId?: UUID | null;
  invoiceId?: string | null;
  dueAt?: ISODateTime | null;
  title: string;
  summary?: string | null;
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
}

export interface SessionCompletionCheckMember {
  profileId: UUID;
  role?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  themeKey?: string | null;
}

export interface SessionCompletionCheckSentActivityEventPayload {
  channelId: UUID;
  learningSpaceId?: UUID | null;
  scheduleId?: UUID | null;
  occurrenceStart: ISODateTime;
  title: string;
  summary?: string | null;
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
  members?: SessionCompletionCheckMember[] | null;
  feedbackUiEnabled: boolean;
}

export interface SessionCompletionCheckBatchSentActivityEventPayload {
  sessions: SessionCompletionCheckSentActivityEventPayload[];
  sessionCount: number;
}

export interface SessionCompletionDisputeReportedActivityEventPayload {
  channelId?: UUID | null;
  learningSpaceId?: UUID | null;
  scheduleId?: UUID | null;
  occurrenceStart: ISODateTime;
  title: string;
  reportedByProfileId: UUID;
  reportedByDisplayName: string;
  reportedByRole: string;
  disputeCategory: string;
  disputeReason?: string | null;
  rescheduleRequested: boolean;
  recipientRole: 'educator' | 'staff';
}

export interface MessageActivityEventPayload {
  channelId: UUID;
  messageId: UUID;
  senderName: string;
  content: string;
  mentionedProfileId?: UUID | null;
  learningSpaceId?: UUID | null;
  learningSpaceTitle?: string | null;
  channelTopic?: string | null;
  channelRouteKind?: 'space' | 'dm' | 'channel' | null;
  threadId?: UUID | null;
  threadReply?: boolean | null;
}
