import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { ParticipantRoleVM } from '@iconicedu/shared-types/vm/class-schedule';

export type SessionChangeRequestTypeVM = 'reschedule' | 'cancel';
export type SessionChangeRequestStatusVM =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'expired'
  | 'withdrawn';

export type SessionChangeApprovalTargetVM =
  | 'educator'
  | 'guardian'
  | 'either_adult'
  | 'staff';

export interface ClassScheduleSelfServePolicyVM {
  orgId: UUID;
  learningSpaceId: UUID;
  enabled: boolean;
  cutoffHours: number;
  allowGuardian: boolean;
  allowEducator: boolean;
  allowChild: boolean;
  withinCutoffRequiresApproval: boolean;
}

export interface SessionChangeRequestVM {
  id: UUID;
  orgId: UUID;
  scheduleId: UUID;
  occurrenceKey: ISODateTime | null;
  learningSpaceId: UUID | null;
  channelId: UUID | null;
  type: SessionChangeRequestTypeVM;
  status: SessionChangeRequestStatusVM;
  requestedByProfileId: UUID;
  requestedByRole: ParticipantRoleVM | string;
  requestedNote: string | null;
  currentStartAt: ISODateTime;
  currentEndAt: ISODateTime;
  requestedStartAt: ISODateTime | null;
  requestedEndAt: ISODateTime | null;
  requestedTimezone: string | null;
  approvalRequiredFrom: SessionChangeApprovalTargetVM;
  decidedByProfileId: UUID | null;
  decisionNote: string | null;
  decidedAt: ISODateTime | null;
  appliedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface SelfServeSessionChangeResultVM {
  status: 'applied' | 'pending' | 'rejected';
  request: SessionChangeRequestVM | null;
  mode: 'single' | 'recurring' | null;
  approvalRequired: boolean;
}

export interface SelfServeRescheduleAvailabilitySlotVM {
  startAt: ISODateTime;
  endAt: ISODateTime;
  label: string;
  hour: number;
}

export interface SelfServeRescheduleAvailabilityDayVM {
  date: string;
  label: string;
  weekdayKey: string;
  slots: SelfServeRescheduleAvailabilitySlotVM[];
}

export interface SelfServeRescheduleOptionsVM {
  timezone: string;
  durationMinutes: number;
  educatorProfileId: UUID | null;
  educatorName: string | null;
  days: SelfServeRescheduleAvailabilityDayVM[];
}
