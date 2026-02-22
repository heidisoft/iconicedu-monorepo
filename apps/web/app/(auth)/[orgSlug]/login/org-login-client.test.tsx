import {
  resolveOrgLoginCallbackUrl,
  shouldRedirectToOrgGetStarted,
} from '@iconicedu/web/app/(auth)/[orgSlug]/login/org-login-client';

describe('resolveOrgLoginCallbackUrl', () => {
  it('builds callback URL with org + login intent', () => {
    const callback = resolveOrgLoginCallbackUrl('iconic-academy');

    expect(callback).toBe(`${window.location.origin}/auth/callback?org=iconic-academy&intent=login`);
  });
});

describe('shouldRedirectToOrgGetStarted', () => {
  it('returns true for missing account reason', () => {
    expect(
      shouldRedirectToOrgGetStarted({
        eligible: false,
        reason: 'missing_account',
      }),
    ).toBe(true);
  });

  it('returns false for suspended reason', () => {
    expect(
      shouldRedirectToOrgGetStarted({
        eligible: false,
        reason: 'suspended',
      }),
    ).toBe(false);
  });
});
