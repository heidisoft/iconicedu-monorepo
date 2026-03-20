import type {
  ClassScheduleVM,
  LiveSessionModeVM,
  LiveSessionProviderVM,
} from '@iconicedu/shared-types';

export type LiveSessionStatus = 'starting' | 'live' | 'ended' | 'failed';

export type LiveSessionProviderCreateInput = {
  sessionId: string;
  orgId: string;
  channelId: string;
  scopeKey: string;
  mode: LiveSessionModeVM;
};

export type LiveSessionProviderCreateResult = {
  providerSessionId: string;
  providerMetadata?: Record<string, unknown>;
};

export type LiveSessionJoinAccessInput = {
  sessionId: string;
  providerSessionId?: string | null;
  providerMetadata?: Record<string, unknown> | null;
  profileId: string;
  displayName: string;
};

export type LiveSessionJoinAccessResult = {
  joinUrl?: string | null;
  token?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type NormalizedLiveSessionParticipantEvent = {
  provider: LiveSessionProviderVM;
  providerSessionId: string;
  providerEventId?: string | null;
  providerParticipantId?: string | null;
  profileId?: string | null;
  participantDisplayName?: string | null;
  participantEmail?: string | null;
  correlationKey?: string | null;
  eventType:
    | 'session_started'
    | 'session_ended'
    | 'participant_joined'
    | 'participant_left';
  occurredAt: string;
  payload: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export interface LiveSessionProviderAdapter {
  readonly key: LiveSessionProviderVM;
  createSession(
    input: LiveSessionProviderCreateInput,
  ): Promise<LiveSessionProviderCreateResult>;
  getJoinAccess(input: LiveSessionJoinAccessInput): Promise<LiveSessionJoinAccessResult>;
  normalizeWebhook(input: {
    headers: Headers;
    body: string;
  }): Promise<NormalizedLiveSessionParticipantEvent[]>;
}

export type ResolvedLiveSessionScope = {
  scopeKey: string;
  occurrenceKey?: string | null;
  occurrenceEndAt?: string | null;
  occurrenceLabel?: string | null;
  schedule?: ClassScheduleVM | null;
  isScheduledSessionWindow?: boolean;
};
