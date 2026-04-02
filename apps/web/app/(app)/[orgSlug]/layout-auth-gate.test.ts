import { describe, expect, it } from 'vitest';

import { shouldRedirectToAuthResume } from '@iconicedu/web/app/(app)/[orgSlug]/layout-auth-gate';

describe('shouldRedirectToAuthResume', () => {
  it('does not redirect when the reauth cookie is absent', () => {
    expect(
      shouldRedirectToAuthResume({
        account: {
          onboarding_completed_at: null,
        } as never,
      }),
    ).toBe(false);
  });

  it('does not redirect for fully onboarded users', () => {
    expect(
      shouldRedirectToAuthResume({
        account: {
          onboarding_completed_at: new Date().toISOString(),
        } as never,
        reauthCookieValue: '1',
      }),
    ).toBe(false);
  });

  it('redirects for incomplete onboarding when the reauth cookie is present', () => {
    expect(
      shouldRedirectToAuthResume({
        account: {
          onboarding_completed_at: null,
        } as never,
        reauthCookieValue: '1',
      }),
    ).toBe(true);
  });
});
