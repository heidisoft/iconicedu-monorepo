'use client';
const KEY = 'iconic-referral-flow';
type Flow = { code: string; phase: 'invitation' | 'signup' | 'verifying' | 'cancelled' };
export function readReferralFlow(): Flow | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return value &&
      /^[a-f0-9]{48}$/.test(value.code) &&
      ['invitation', 'signup', 'verifying', 'cancelled'].includes(value.phase)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function markReferralFlow(code: string, phase: Flow['phase']) {
  if (!/^[a-f0-9]{48}$/.test(code)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code, phase }));
  } catch {
    /* Cookie checks remain authoritative. */
  }
}
export function activeReferralCode(code?: string) {
  const flow = readReferralFlow();
  return code && !(flow?.code === code && flow.phase === 'cancelled') ? code : undefined;
}
export function cancelReferralFlow(code: string) {
  markReferralFlow(code, 'cancelled');
  const body = JSON.stringify({ code });
  // This same-origin endpoint only removes HttpOnly web attribution, not business data.
  try {
    if (navigator.sendBeacon?.('/api/referrals/cancel', body)) return;
  } catch {
    /* Fall back to keepalive. */
  }
  void fetch('/api/referrals/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body,
  }).catch(() => {});
}
