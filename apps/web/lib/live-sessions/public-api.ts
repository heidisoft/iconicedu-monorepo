// Public (no-auth) endpoints, called from the client — unlike the rest of
// apps/web/lib/live-sessions, which runs server-side with a service-role
// Supabase client. Mirrors the pattern in lib/assessments/api.ts's public
// delivery lookup: NEXT_PUBLIC_API_URL only, since this also runs in the browser.
const DEFAULT_LOCAL_API_URL = 'http://localhost:3001';

function getApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_LOCAL_API_URL).replace(/\/+$/, '');
}

export type GuestLiveSessionJoinResult = {
  token: string;
  sessionName: string;
  displayName: string;
  expiresAt: string | null;
};

export type GuestLiveSessionJoinError = {
  status: number;
  message: string;
};

export async function guestJoinLiveSession(
  sessionId: string,
  body: { displayName: string; passcode: string },
): Promise<GuestLiveSessionJoinResult | GuestLiveSessionJoinError> {
  try {
    const res = await fetch(`${getApiUrl()}/live-sessions/${sessionId}/guest-join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      return {
        status: res.status,
        message:
          typeof payload?.message === 'string'
            ? payload.message
            : 'Failed to join session',
      };
    }

    return res.json();
  } catch {
    return { status: 0, message: 'Unable to reach the server' };
  }
}

// Accepts an optional Supabase access token so a signed-in host/member's
// rating is attributed to their profile — omit it for an anonymous guest.
export async function submitLiveSessionFeedback(
  sessionId: string,
  body: { rating: number; displayName: string },
  accessToken?: string | null,
): Promise<{ success: true } | GuestLiveSessionJoinError> {
  try {
    const res = await fetch(`${getApiUrl()}/live-sessions/${sessionId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      return {
        status: res.status,
        message:
          typeof payload?.message === 'string'
            ? payload.message
            : 'Failed to submit feedback',
      };
    }

    return res.json();
  } catch {
    return { status: 0, message: 'Unable to reach the server' };
  }
}

// Fire-and-forget telemetry — the embed's network-quality-change /
// connection-change listeners call this on a degraded transition. Never
// throws: a dropped quality report shouldn't surface as a user-facing error
// on top of the connection trouble it's trying to report.
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
    await fetch(`${getApiUrl()}/live-sessions/${sessionId}/quality-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Best effort — see doc comment above.
  }
}

// Stub audit trail for privileged in-session actions — see
// logLiveSessionAuditEvent on the API side for scope/limitations. Also
// fire-and-forget: a privileged action already happened by the time this is
// called, so a failed audit write shouldn't block or error out the action.
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
    await fetch(`${getApiUrl()}/live-sessions/${sessionId}/audit-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Best effort — see doc comment above.
  }
}
