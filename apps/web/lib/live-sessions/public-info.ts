// Server-only: called from the /live/[sessionId] Server Component, which
// forwards the visitor's Supabase access token (if signed in) so apps/api can
// determine host status. Deliberately not in public-api.ts — that file is for
// client-side calls and only ever sends NEXT_PUBLIC_API_URL requests with no
// auth header.
const DEFAULT_LOCAL_API_URL = 'http://localhost:3001';

function getApiUrl() {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_LOCAL_API_URL
  ).replace(/\/+$/, '');
}

export type PublicLiveSessionInfo =
  | { exists: false }
  | { exists: true; isActive: false; sessionTitle: string }
  | { exists: true; isActive: true; sessionTitle: string; isHost: false }
  | {
      exists: true;
      isActive: true;
      sessionTitle: string;
      isHost: true;
      hostJoin: { token: string; sessionName: string; displayName: string };
    };

export async function getPublicLiveSessionInfo(
  sessionId: string,
  accessToken: string | null,
): Promise<PublicLiveSessionInfo> {
  const res = await fetch(`${getApiUrl()}/live-sessions/${sessionId}/public-info`, {
    cache: 'no-store',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (!res.ok) {
    return { exists: false };
  }

  return res.json();
}
