import { describe, expect, it } from 'vitest';

import {
  INCOMPLETE_ONBOARDING_REAUTH_AFTER_MS,
  markLastActiveAt,
  shouldRequireReauthOnReturn,
} from './session-reauth';

describe('markLastActiveAt', () => {
  it('returns the provided timestamp', () => {
    expect(markLastActiveAt(1234)).toBe(1234);
  });
});

describe('shouldRequireReauthOnReturn', () => {
  it('returns true for incomplete onboarding after the threshold', () => {
    expect(
      shouldRequireReauthOnReturn({
        isOnboardingComplete: false,
        lastActiveAt: 1000,
        now: 1000 + INCOMPLETE_ONBOARDING_REAUTH_AFTER_MS,
      }),
    ).toBe(true);
  });

  it('returns false for incomplete onboarding under the threshold', () => {
    expect(
      shouldRequireReauthOnReturn({
        isOnboardingComplete: false,
        lastActiveAt: 1000,
        now: 1000 + INCOMPLETE_ONBOARDING_REAUTH_AFTER_MS - 1,
      }),
    ).toBe(false);
  });

  it('returns false for completed onboarding', () => {
    expect(
      shouldRequireReauthOnReturn({
        isOnboardingComplete: true,
        lastActiveAt: 1000,
        now: 1000 + INCOMPLETE_ONBOARDING_REAUTH_AFTER_MS + 1000,
      }),
    ).toBe(false);
  });
});
