import type { LiveSessionSettingsVM } from './live-session-settings';
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
  participants?: LiveSessionProfileSummaryVM[];
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

/** Enrolled child a verified guardian may represent in a live class. */
export type LiveSessionStudentOptionVM = { profileId: UUID; displayName: string };
export type LiveSessionJoinRequest = {
  admissionToken?: string;
  linkToken?: string;
  /** Explicit preview edit; changes the meeting label, never the authorized identity. */
  displayNameOverride?: string;
  displayName: string;
  passcode: string;
  studentProfileId?: UUID;
};

/** Credentials issued by apps/api after host authorization or passcode verification. */
export type LiveSessionJoinCredentialsVM = {
  sharePath?: string;
  /** API-verified student represented by a signed-in guardian. */
  studentProfileId?: UUID;
  /** Meeting-scoped opaque annotation capability for shared-link participants. */
  annotationToken?: string;
  whiteboard?: import('./whiteboard').WhiteboardAccessVM;
  token: string;
  /** Canonical Zoom topic for this class session; web and native pass it to the SDK verbatim. */
  sessionName: string;
  displayName: string;
  meetingPasscode?: string | null;
  expiresAt: string | null;
  settings?: LiveSessionSettingsVM;
};

/** Public landing data; participant identity never grants host privileges. */
export type PublicLiveSessionInfoVM =
  | { exists: false }
  | { exists: true; isActive: false; sessionTitle: string }
  | {
      exists: true;
      isActive: true;
      sessionId?: string;
      shareCode?: string;
      settings?: LiveSessionSettingsVM;
      sessionTitle: string;
      isHost: false;
      passcodeRequired?: boolean;
      participant?: { displayName: string; students?: LiveSessionStudentOptionVM[] };
    }
  | {
      exists: true;
      isActive: true;
      sessionId?: string;
      shareCode?: string;
      settings?: LiveSessionSettingsVM;
      sessionTitle: string;
      isHost: true;
      hostJoin: LiveSessionJoinCredentialsVM & { passcode: string | null };
    };

/** Authorized channel join response; passcode is separate from the public URL. */
export interface LiveSessionJoinLinkVM {
  /** Guest invitation capability; distinct from a personal browser handoff. */
  sharePath?: string;
  joinPath: string;
  provider?: LiveSessionProviderVM;
  passcode?: string | null;
}

export type MeetingAdmissionVM = {
  token: string;
  status: 'waiting' | 'approved' | 'denied' | 'ended';
};
export type MeetingWaitingParticipantVM = {
  id: string;
  displayName: string;
  createdAt: string;
};

/** API-owned routing for legacy signed-in meeting URLs. Zoom never embeds directly. */
export type LiveSessionMemberAccessVM =
  | { provider: 'zoom'; joinPath: string; returnPath: string }
  | {
      provider: Exclude<LiveSessionProviderVM, 'zoom'>;
      returnPath: string;
      channelTopic: string | null;
      channelPurpose: string | null;
      channelKind: string | null;
      mode: 'audio' | 'video' | null;
      joinUrl: string | null;
      token: string | null;
      externalJoinUrl: string | null;
      displayName: string;
    };

export type LiveSessionQualityEventVM = {
  id: string;
  display_name: string;
  metric: 'network_quality' | 'connection_state';
  level: string;
  occurred_at: string;
};
