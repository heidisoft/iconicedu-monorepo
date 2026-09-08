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

export interface AdminSessionCompletionActorVM {
  profileId: UUID;
  displayName: string;
  role: ParticipantRoleVM;
  status: Extract<ClassSessionCompletionStatus, 'confirmed' | 'auto_confirmed'>;
  completedAt: ISODateTime;
}

/**
 * A guardian attached to the session's schedule — the parent whose child sits in
 * the occurrence, whether or not that parent personally confirmed it. Powers the
 * admin "Parent" filter: picking a parent shows every completed session for their
 * kid, with `confirmedBy` reporting who actually confirmed.
 */
export interface AdminSessionCompletionGuardianVM {
  profileId: UUID;
  displayName: string;
}

/** One completed schedule occurrence, grouped across all participant confirmations. */
export interface AdminSessionCompletionVM {
  id: string;
  orgId: UUID;
  scheduleId: UUID;
  occurrenceKey: ISODateTime;
  sessionEndAt: ISODateTime;
  sessionTitle?: string | null;
  studentNames: string[];
  channelId?: UUID | null;
  learningSpaceId?: UUID | null;
  learningSpaceTitle?: string | null;
  completedAt: ISODateTime;
  completionMethod: 'confirmed' | 'auto_confirmed' | 'mixed';
  confirmedBy: AdminSessionCompletionActorVM[];
  guardians: AdminSessionCompletionGuardianVM[];
  averageRating?: number | null;
}
