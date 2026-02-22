import { resolveOrgLoginCallbackUrl } from '@iconicedu/web/app/(auth)/[orgSlug]/login/org-login-client';

describe('resolveOrgLoginCallbackUrl', () => {
  it('builds callback URL with org + login intent', () => {
    const callback = resolveOrgLoginCallbackUrl('iconic-academy');

    expect(callback).toBe(`${window.location.origin}/auth/callback?org=iconic-academy&intent=login`);
  });
});
