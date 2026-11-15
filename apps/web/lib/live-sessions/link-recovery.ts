/** Tab-scoped capability recovery; never transferred through clipboard or application auth. */
export type MeetingLinkRecovery = {
  token: string;
  personal: boolean;
  handoff: boolean;
  redemptionKey: string;
  expiresAt: number;
};
const key = (sessionId: string) => `iconicedu:meeting-link:${sessionId}`;
export function readMeetingLink(sessionId: string): MeetingLinkRecovery | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(sessionId)) ?? 'null');
    if (
      value &&
      /^[\w-]{32}$/.test(value.token) &&
      /^[\w-]{32}$/.test(value.redemptionKey) &&
      typeof value.personal === 'boolean' &&
      typeof value.handoff === 'boolean' &&
      value.expiresAt > Date.now()
    )
      return value;
    clearMeetingLink(sessionId);
  } catch {
    /* Storage may be unavailable. */
  }
  return null;
}
export function writeMeetingLink(sessionId: string, value: MeetingLinkRecovery) {
  try {
    sessionStorage.setItem(key(sessionId), JSON.stringify(value));
  } catch {
    /* Joining remains available. */
  }
}
export function clearMeetingLink(sessionId: string) {
  try {
    sessionStorage.removeItem(key(sessionId));
  } catch {
    /* Leaving remains available. */
  }
}
export function newRedemptionKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
