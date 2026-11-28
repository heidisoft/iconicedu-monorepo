import type { ISODateTime, UUID } from '../shared/shared';
import type { ParticipantRoleVM } from './class-schedule';
import type {
  ClassSessionCompletionDisputeCategory,
  ClassSessionCompletionStatus,
} from '../rows/class-session-completion';

// One VM, consumed by both the notifications hydration and the homepage carousel
// endpoint — the whole point of consolidation is that both surfaces read this same
// shape instead of each reconstructing it from separate tables.
/** Who marked a completed session as complete, from the viewer's own row. */
export type SessionCompletionConfirmedBy = 'self' | 'staff' | 'system';

/** A participant's report that their session was wrongly marked complete. */
export interface SessionCompletionReportVM {
  category: ClassSessionCompletionDisputeCategory;
  reason: string | null;
  reportedAt: ISODateTime;
}

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
  /** Set for confirmed / auto_confirmed rows; absent from older API deployments. */
  confirmedBy?: SessionCompletionConfirmedBy | null;
  report?: SessionCompletionReportVM | null;
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

/**
 * A profile in the org matching a given `kind` ('educator' or 'guardian'),
 * independent of any specific schedule or completion. Powers the admin
 * "Filter by participant" teacher/parent dropdowns, so every teacher/parent in
 * the org is selectable, not just ones with a completion in the loaded window.
 */
export interface AdminOrgProfileOptionVM {
  profileId: UUID;
  displayName: string;
}

/** A tutor or parent, including people who have not manually confirmed. */
export interface AdminSessionCompletionParticipantVM {
  profileId: UUID;
  displayName: string;
  role: 'educator' | 'guardian';
  status: ClassSessionCompletionStatus;
  rating?: number | null;
  /**
   * Set when this person's 'confirmed' status came from a staff override
   * (admin confirm-occurrence) rather than the person confirming it themselves —
   * i.e. the row's `updated_by` differs from its `profile_id`. Absent for a
   * self-confirmed or auto-confirmed row.
   */
  confirmedByStaff?: {
    profileId: UUID;
    displayName: string;
    confirmedAt: ISODateTime;
  } | null;
  /** Set when this person's row is 'disputed' — the reason they (or staff, on
   * their behalf) reported a problem with the session. */
  disputeDetails?: {
    category: ClassSessionCompletionDisputeCategory;
    reason: string | null;
    rescheduleRequested: boolean;
    disputedAt: ISODateTime;
  } | null;
}

/** A participant's "wrongly marked complete" report, surfaced to staff. */
export interface AdminSessionCompletionReportVM extends SessionCompletionReportVM {
  profileId: UUID;
  displayName: string;
  role: ParticipantRoleVM;
}

/** One schedule occurrence within the admin reporting window, whether completed,
 * still pending confirmation, or under dispute — grouped across all participant
 * confirmations. */
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
  completionMethod: 'confirmed' | 'auto_confirmed' | 'mixed' | 'pending' | 'disputed';
  confirmedBy: AdminSessionCompletionActorVM[];
  guardians: AdminSessionCompletionGuardianVM[];
  /** Optional while older API deployments are being replaced. */
  participants?: AdminSessionCompletionParticipantVM[];
  /** Every participant (any role, students included) who reported the session
   * as wrongly marked complete. Optional while older API deployments roll out. */
  reports?: AdminSessionCompletionReportVM[];
  averageRating?: number | null;
  /**
   * Actual session length in minutes as confirmed by staff, when it differs from
   * (or reaffirms) the scheduled sessionEndAt - occurrenceKey duration. Null until
   * a staff adminConfirm sets it, or after an adminUndoConfirm clears it.
   */
  verifiedMinutes?: number | null;
  verificationNote?: string | null;
}
