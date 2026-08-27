import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClassSessionJoinAvailabilityVM,
  ClassSessionJoinResultVM,
  JoinClassSessionOccurrencePayload,
  LiveSessionProviderVM,
} from '@iconicedu/shared-types';

import { createApiClient } from '@iconicedu/web/lib/api/http-client';

/**
 * Typed access to the API-owned live-session join contract (issue #195).
 *
 * Join authorization, occurrence identity, and rollout gating all live in
 * `apps/api`; web only forwards the caller's identity and the occurrence they
 * clicked. Nothing here decides eligibility.
 */

export type ChannelLiveSessionJoinResult = {
  sessionId: string;
  joinPath: string;
  status: 'starting' | 'live' | 'ended' | 'failed';
  created: boolean;
  provider: LiveSessionProviderVM;
};

type ActorInput = {
  orgSlug: string;
  /** Effective profile when a guardian is browsing as a linked child. */
  actingProfileId?: string | null;
};

export function createLiveSessionsApiClient(supabase: SupabaseClient) {
  const api = createApiClient(supabase);

  return {
    getClassSessionJoinAvailability(
      input: ActorInput & JoinClassSessionOccurrencePayload,
    ): Promise<ClassSessionJoinAvailabilityVM> {
      return api.post<ClassSessionJoinAvailabilityVM>(
        '/live-sessions/class-sessions/availability',
        input,
      );
    },

    listClassSessionJoinAvailability(
      input: ActorInput & { fromAt: string; toAt: string },
    ): Promise<ClassSessionJoinAvailabilityVM[]> {
      return api.post<ClassSessionJoinAvailabilityVM[]>(
        '/live-sessions/class-sessions/availability-range',
        input,
      );
    },

    joinClassSessionOccurrence(
      input: ActorInput & JoinClassSessionOccurrencePayload,
    ): Promise<ClassSessionJoinResultVM> {
      return api.post<ClassSessionJoinResultVM>(
        '/live-sessions/class-sessions/join',
        input,
      );
    },

    joinChannelLiveSession(
      input: ActorInput & { channelId: string },
    ): Promise<ChannelLiveSessionJoinResult> {
      const { channelId, ...body } = input;
      return api.post<ChannelLiveSessionJoinResult>(
        `/live-sessions/channels/${channelId}/join`,
        body,
      );
    },

    resolveRoomJoinAccess(input: ActorInput & { liveSessionId: string }): Promise<{
      sessionId: string;
      channelId: string;
      provider: LiveSessionProviderVM;
      status: 'starting' | 'live' | 'ended' | 'failed';
      occurrenceKey: string | null;
      joinAccess: {
        joinUrl?: string | null;
        token?: string | null;
        expiresAt?: string | null;
        metadata?: Record<string, unknown>;
      };
    }> {
      const { liveSessionId, ...body } = input;
      return api.post(`/live-sessions/rooms/${liveSessionId}/join-access`, body);
    },
  };
}
