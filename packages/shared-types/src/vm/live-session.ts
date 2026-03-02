import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { LiveSessionProviderVM } from '@iconicedu/shared-types/vm/channel';

export type LiveSessionAttendanceStatusVM = 'starting' | 'live' | 'ended' | 'failed';
export type LiveSessionAttendanceScopeVM = 'scheduled' | 'ad-hoc';
export type LiveSessionParticipantStatusVM = 'requested' | 'joined' | 'left';

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
  attendeeCount: number;
  noShowCount: number;
  averageAttendanceSeconds?: number | null;
  durationSeconds?: number | null;
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
  startedBy: LiveSessionProfileSummaryVM | null;
  metrics: LiveSessionAttendanceMetricsVM;
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
}

export interface LiveSessionAttendanceDetailVM {
  session: LiveSessionAttendanceListItemVM;
  participants: LiveSessionAttendanceParticipantVM[];
}

export interface LiveSessionAttendanceFilterVM {
  channelId?: UUID | null;
  learningSpaceId?: UUID | null;
  dateFrom?: ISODateTime | null;
  dateTo?: ISODateTime | null;
  status?: LiveSessionAttendanceStatusVM | null;
}
