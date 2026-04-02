export const INCOMPLETE_ONBOARDING_REAUTH_AFTER_MS = 15 * 60 * 1000;

export interface SessionReauthPolicyInput {
  isOnboardingComplete: boolean;
  lastActiveAt: number | null;
  now: number;
  reauthAfterMs?: number;
}

export function markLastActiveAt(now = Date.now()): number {
  return now;
}

export function shouldRequireReauthOnReturn(input: SessionReauthPolicyInput): boolean {
  if (input.isOnboardingComplete) {
    return false;
  }

  if (input.lastActiveAt == null || !Number.isFinite(input.lastActiveAt)) {
    return false;
  }

  if (!Number.isFinite(input.now)) {
    return false;
  }

  const reauthAfterMs = input.reauthAfterMs ?? INCOMPLETE_ONBOARDING_REAUTH_AFTER_MS;
  if (reauthAfterMs <= 0) {
    return false;
  }

  return input.now - input.lastActiveAt >= reauthAfterMs;
}
