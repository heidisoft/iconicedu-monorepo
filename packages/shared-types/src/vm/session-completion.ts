import type { ISODateTime, UUID } from '../shared/shared';
import type {
  ClassSessionCompletionDisputeCategory,
  ClassSessionCompletionStatus,
} from '../rows/class-session-completion';

// One VM, consumed by both the notifications hydration and the homepage carousel
// endpoint — the whole point of consolidation is that both surfaces read this same
// shape instead of each reconstructing it from separate tables.
export interface SessionCompletionVM {
  id: UUID;
  orgId: UUID;
  scheduleId: UUID;
  occurrenceKey: ISODateTime;
  profileId: UUID;
  role: string;
  status: ClassSessionCompletionStatus;
  disputeCategory?: ClassSessionCompletionDisputeCategory | null;
  disputeReason?: string | null;
  rescheduleRequested: boolean;
  rating?: number | null;
  ratingComment?: string | null;
  channelId?: UUID | null;
  learningSpaceId?: UUID | null;
  sessionTitle?: string | null;
  sessionEndAt: ISODateTime;
  resolvedAt?: ISODateTime | null;
  expiresAt: ISODateTime;
}
