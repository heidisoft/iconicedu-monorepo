import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

/**
 * Request payload for joining one exact class-session occurrence (issue #195).
 *
 * The organization is resolved from the authenticated actor, never from the
 * request body, so a caller cannot address another tenant's occurrence.
 */
export interface JoinClassSessionOccurrencePayload {
  scheduleId: UUID;
  /** Original occurrence start; see `ClassSessionOccurrenceIdentityVM`. */
  occurrenceKey: ISODateTime;
}

export interface ClassSessionJoinAvailabilityQueryPayload {
  /** Inclusive ISO range the caller wants availability for. */
  fromAt: ISODateTime;
  toAt: ISODateTime;
}
