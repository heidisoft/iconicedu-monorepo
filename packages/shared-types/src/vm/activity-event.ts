import type {
  AudienceRuleVM,
  FeedScopeVM,
  ActivitySourceKindVM,
  ActivityVerbVM,
} from '@iconicedu/shared-types/vm/activity-feed';
import type { EntityRefVM, ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

export type ActivityEventTypeVM = ActivityVerbVM | 'session.ended' | 'payment.received' | 'payment.failed' | 'system.notice';

export interface ActivityEventIdsVM {
  id: UUID;
  orgId: UUID;
}

export interface ActivityEventBaseVM<TPayload extends Record<string, unknown> = Record<string, unknown>> {
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
  memberProfileId: UUID;
  memberDisplayName?: string | null;
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

export interface SystemNoticeActivityEventPayload {
  title: string;
  message?: string | null;
  href?: string | null;
  actionLabel?: string | null;
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
