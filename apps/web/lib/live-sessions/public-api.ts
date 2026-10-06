import type { LiveSessionJoinCredentialsVM } from '@iconicedu/shared-types';
import { ApiHttpError, createPublicApiClient } from '@iconicedu/web/lib/api/http-client';

export type GuestLiveSessionJoinResult = LiveSessionJoinCredentialsVM;
export type GuestLiveSessionJoinError = { status: number; message: string };

function describeRequestFailure(error: unknown): GuestLiveSessionJoinError {
  return error instanceof ApiHttpError
    ? { status: error.status, message: error.message }
    : { status: 0, message: 'Unable to reach the server' };
}

export async function guestJoinLiveSession(
  sessionId: string,
  body: { displayName: string; passcode: string },
  accessToken?: string | null,
): Promise<GuestLiveSessionJoinResult | GuestLiveSessionJoinError> {
  try {
    return await createPublicApiClient(accessToken).post<GuestLiveSessionJoinResult>(
      `/live-sessions/${encodeURIComponent(sessionId)}/guest-join`,
      body,
    );
  } catch (error) {
    return describeRequestFailure(error);
  }
}

export async function submitLiveSessionFeedback(
  sessionId: string,
  body: { rating: number; displayName: string },
  accessToken?: string | null,
): Promise<{ success: true } | GuestLiveSessionJoinError> {
  try {
    return await createPublicApiClient(accessToken).post<{ success: true }>(
      `/live-sessions/${encodeURIComponent(sessionId)}/feedback`,
      body,
    );
  } catch (error) {
    return describeRequestFailure(error);
  }
}

/** Telemetry is best effort and cannot block a meeting action. */
export async function reportLiveSessionQualityEvent(
  sessionId: string,
  body: {
    displayName: string;
    metric: 'network_quality' | 'connection_state';
    level: string;
    occurredAt: string;
  },
  accessToken?: string | null,
): Promise<void> {
  try {
    await createPublicApiClient(accessToken).post(
      `/live-sessions/${encodeURIComponent(sessionId)}/quality-events`,
      body,
    );
  } catch {
    /* A dropped quality report must not interrupt the session. */
  }
}

/** Privileged actions complete independently of their best-effort audit report. */
export async function logLiveSessionAuditEvent(
  sessionId: string,
  body: {
    action: 'mute_participant' | 'end_session_for_all' | 'recording_started';
    targetDisplayName?: string | null;
    occurredAt: string;
  },
  accessToken?: string | null,
): Promise<void> {
  try {
    await createPublicApiClient(accessToken).post(
      `/live-sessions/${encodeURIComponent(sessionId)}/audit-events`,
      body,
    );
  } catch {
    /* A dropped audit report must not interrupt the session. */
  }
}
