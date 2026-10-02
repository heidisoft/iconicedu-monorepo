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
