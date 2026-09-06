import type { ISODateTime, UUID } from '../shared/shared';
import type { ParticipantRoleVM } from './class-schedule';
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
  role: ParticipantRoleVM;
  status: ClassSessionCompletionStatus;
  disputeCategory?: ClassSessionCompletionDisputeCategory | null;
  disputeReason?: string | null;
  rescheduleRequested: boolean;
  rating?: number | null;
  ratingComment?: string | null;
  channelId?: UUID | null;
  learningSpaceId?: UUID | null;
  sessionTitle?: string | null;
  studentName?: string | null;
  sessionEndAt: ISODateTime;
  notifiedAt?: ISODateTime | null;
  confirmedAt?: ISODateTime | null;
  disputedAt?: ISODateTime | null;
  ratedAt?: ISODateTime | null;
  resolvedAt?: ISODateTime | null;
  expiresAt: ISODateTime;
}

// One schedule occurrence that at least one participant (educator/teacher,
// guardian/parent, or staff) has confirmed complete. Powers the classroom
// Sessions tab's completed state — an occurrence is done the moment ANY party
// confirms it (`status` 'confirmed' or 'auto_confirmed'); disputes are ignored.
export interface ChannelSessionCompletionVM {
  scheduleId: UUID;
  occurrenceKey: ISODateTime;
}
