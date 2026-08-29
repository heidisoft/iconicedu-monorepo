import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { LiveSessionProviderVM } from '@iconicedu/shared-types/vm/channel';

export type LiveSessionAttendanceStatusVM = 'starting' | 'live' | 'ended' | 'failed';
export type LiveSessionAttendanceScopeVM = 'scheduled' | 'ad-hoc';
export type LiveSessionParticipantStatusVM = 'requested' | 'joined' | 'left';
export type LiveSessionAttendanceParticipantStatusVM =
  | 'expected'
  | 'attended'
  | 'partial'
  | 'full'
  | 'no_show'
  | 'excused';

export interface LiveSessionProfileSummaryVM {
  ids: {
    id: UUID;
    orgId: UUID;
    accountId: UUID;
  };
  kind: 'educator' | 'guardian' | 'child' | 'staff' | 'system';
  profile: {
    displayName: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phoneE164?: string | null;
    bio?: string | null;
    avatar: {
      source: 'uploaded' | 'generated' | 'external';
      url?: string | null;
      seed?: string | null;
    };
  };
}

export interface LiveSessionAttendanceMetricsVM {
  participantCount: number;
  expectedParticipantCount: number;
  attendeeCount: number;
  fullAttendanceCount: number;
  partialAttendanceCount: number;
  noShowCount: number;
  attendanceRate?: number | null;
  fullAttendanceRate?: number | null;
  averageAttendanceSeconds?: number | null;
  durationSeconds?: number | null;
}

export interface LiveSessionAttendancePolicyVM {
  fullAttendanceThresholdPercent: number;
  graceSeconds?: number | null;
  countLateJoinAsAttended: boolean;
  countRejoins: boolean;
  source: 'hybrid';
}

export interface LiveSessionAttendanceListItemVM {
  ids: {
    id: UUID;
    orgId: UUID;
    channelId: UUID;
  };
  provider: LiveSessionProviderVM;
  status: LiveSessionAttendanceStatusVM;
  scope: LiveSessionAttendanceScopeVM;
  occurrenceKey?: ISODateTime | null;
  channelTopic: string;
  channelPurpose: string;
  learningSpaceId?: UUID | null;
  learningSpaceTitle?: string | null;
  startedAt: ISODateTime;
  endedAt?: ISODateTime | null;
  failedAt?: ISODateTime | null;
  failureReason?: string | null;
  joinPath: string;
  reportGeneratedAt?: ISODateTime | null;
  startedBy: LiveSessionProfileSummaryVM | null;
  metrics: LiveSessionAttendanceMetricsVM;
}

export interface LiveSessionAttendanceParticipantOutcomeVM {
  expectedToAttend: boolean;
  attendanceStatus: LiveSessionAttendanceParticipantStatusVM;
  attendanceRatio?: number | null;
  qualifiedFullAttendance: boolean;
  requiredSeconds?: number | null;
  creditedSeconds?: number | null;
  evaluationReason?: string | null;
}

export interface LiveSessionAttendanceParticipantVM {
  ids: {
    id: UUID;
    orgId: UUID;
    liveSessionId: UUID;
    channelId: UUID;
    profileId: UUID;
  };
  participant: LiveSessionProfileSummaryVM | null;
  joinRequestedAt?: ISODateTime | null;
  firstJoinedAt?: ISODateTime | null;
  lastJoinedAt?: ISODateTime | null;
  lastLeftAt?: ISODateTime | null;
  joinCount: number;
  totalSeconds?: number | null;
  lastKnownStatus: LiveSessionParticipantStatusVM;
  attended: boolean;
  noShow: boolean;
  expectedToAttend: boolean;
  attendanceStatus: LiveSessionAttendanceParticipantStatusVM;
  attendanceRatio?: number | null;
  qualifiedFullAttendance: boolean;
  requiredSeconds?: number | null;
  creditedSeconds?: number | null;
  evaluationReason?: string | null;
}

export interface LiveSessionParticipantTimelineVM {
  id: string;
  liveSessionId: UUID;
  profileId?: UUID | null;
  participantDisplayName?: string | null;
  providerParticipantId?: string | null;
  provider: LiveSessionProviderVM;
  eventType:
    | 'join_requested'
    | 'participant_joined'
    | 'participant_left'
    | 'session_started'
    | 'session_ended';
  occurredAt: ISODateTime;
  source: 'app' | 'provider_webhook';
  correlationKey?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface LiveSessionAttendanceDetailVM {
  session: LiveSessionAttendanceListItemVM;
  participants: LiveSessionAttendanceParticipantVM[];
  policy: LiveSessionAttendancePolicyVM;
  reportGeneratedAt?: ISODateTime | null;
  timeline?: LiveSessionParticipantTimelineVM[];
}

export interface LiveSessionAttendanceFilterVM {
  channelId?: UUID | null;
  learningSpaceId?: UUID | null;
  dateFrom?: ISODateTime | null;
  dateTo?: ISODateTime | null;
  status?: LiveSessionAttendanceStatusVM | null;
}
