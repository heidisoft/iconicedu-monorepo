import type {
  ClassSessionJoinAvailabilityVM,
  ClassSessionJoinResultVM,
} from '@iconicedu/shared-types';

import { apiPost } from '@/lib/api/http-client';

/**
 * Typed access to the API-owned class-session join contract (issue #195).
 *
 * Mobile no longer reads `learning_space_channels` / `channels.live_session_config`
 * directly to work out a join target: the API decides eligibility and returns the
 * join path for one exact occurrence.
 */

export type ClassSessionOccurrenceRef = {
  scheduleId: string;
  occurrenceKey: string;
};

export async function fetchClassSessionJoinAvailability(input: {
  orgId: string;
  fromAt: string;
  toAt: string;
}): Promise<ClassSessionJoinAvailabilityVM[]> {
  return apiPost<ClassSessionJoinAvailabilityVM[]>(
    '/live-sessions/class-sessions/availability-range',
    input,
  );
}

export async function joinClassSessionOccurrence(
  input: ClassSessionOccurrenceRef & { orgId: string },
): Promise<ClassSessionJoinResultVM> {
  return apiPost<ClassSessionJoinResultVM>('/live-sessions/class-sessions/join', input);
}

export async function joinChannelLiveSession(input: {
  orgId: string;
  channelId: string;
}): Promise<{
  sessionId: string;
  joinPath: string;
  status: 'starting' | 'live' | 'ended' | 'failed';
  created: boolean;
  provider: 'daily' | 'zoom' | 'jitsi' | 'custom';
}> {
  return apiPost(`/live-sessions/channels/${input.channelId}/join`, {
    orgId: input.orgId,
  });
}

export function buildClassSessionJoinAvailabilityKey(
  scheduleId: string,
  occurrenceKey: string,
) {
  return `${scheduleId}|${occurrenceKey}`;
}

export function buildJoinEligibilityIndex(
  availability: ClassSessionJoinAvailabilityVM[],
): Map<string, boolean> {
  return new Map(
    availability.map((entry) => [
      buildClassSessionJoinAvailabilityKey(
        entry.occurrence.scheduleId,
        entry.occurrence.occurrenceKey,
      ),
      entry.eligible,
    ]),
  );
}
